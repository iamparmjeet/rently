import { ORPCError } from "@orpc/server";
import { workspaceCapabilities } from "@rently/api/modules/sample-workspace";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { OWNER_ONLY_PAYMENT_METHODS_VALUE } from "@rently/db/constants/payment-constants";
import {
	LEASE_AGREEMENT_ARRANGEMENT,
	PAYMENT_TYPES,
} from "@rently/db/constants/rent-constants";
import type { UserRole } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	notifications,
	paymentGroups,
	payments,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	sendAgreementPaymentReceiptEmail,
	sendPaymentReceiptEmail,
} from "@rently/email";
import {
	CreateAgreementPaymentSchema,
	CreatePaymentSchema,
	PaymentGroupSelectSchema,
	PaymentListItemSchema,
	PaymentSelectSchema,
	UpdatePaymentSchema,
} from "@rently/validators";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";
import {
	sendAutomaticAgreementPaymentReceipt,
	sendAutomaticPaymentReceipt,
} from "../helpers/automatic-emails";
import {
	getAmountDueForRent,
	getAmountDueForUtility,
} from "../helpers/credit.helpers";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

const formatRupees = (paise: number) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(paise / 100);

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "23505"
	);
}

// ─── Shared helper ─────
function assertMethodAllowedForRole(
	method: string | null | undefined,
	role: UserRole,
) {
	if (!method) return;
	const isOwnerOnly = (
		OWNER_ONLY_PAYMENT_METHODS_VALUE as readonly string[]
	).includes(method);

	if (isOwnerOnly && role !== "owner") {
		throw new ORPCError("FORBIDDEN", {
			message: "Cash and cheque payments can only be recorded by the owner",
		});
	}
}
// Fetches a payment + walks the JOIN chain to get ownerId for auth
async function getOwnedPayment(
	db: Database,
	paymentId: string,
	userId: string,
) {
	const [row] = await db
		.select({
			id: payments.id,
			leaseId: payments.leaseId,
			amount: payments.amount,
			paymentDate: payments.paymentDate,
			paymentMethods: payments.paymentMethods,
			referenceNumber: payments.referenceNumber,
			type: payments.type,
			description: payments.description,
			utilityId: payments.utilityId,
			createdAt: payments.createdAt,
			updatedAt: payments.updatedAt,
			paymentGroupId: payments.paymentGroupId,
			ownerId: properties.ownerId,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(payments.id, paymentId))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not own this payment",
		});
	}

	return row;
}

// Create — GST-safe: amount must equal derived amountDue, isPaid derived, reversal blocked via Zod
export const createPayment = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreatePaymentSchema)
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Reversal exclusion + type/utility pairing are enforced by
		// CreatePaymentSchema; the database CHECK is the backstop.

		const ownsLease = await isLeaseOwner(db, authUser.id, input.leaseId);
		if (!ownsLease) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this lease",
			});
		}

		assertMethodAllowedForRole(input.paymentMethods, "owner");

		const utilityId = input.utilityId ?? null;

		// Validate utility belongs to lease when provided
		if (utilityId) {
			const [util] = await db
				.select({ id: utilities.id, leaseId: utilities.leaseId })
				.from(utilities)
				.where(eq(utilities.id, utilityId))
				.limit(1);
			if (!util || util.leaseId !== input.leaseId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Utility does not belong to this lease",
				});
			}
		}

		// A client-supplied idempotency key makes a double-submit self-reject via
		// the partial unique index, closing the Neon HTTP race (no FOR UPDATE).
		const idempotencyKey = input.idempotencyKey ?? null;

		let payment: typeof payments.$inferSelect | undefined;
		if (supportsBatch(db)) {
			if (idempotencyKey) {
				const [existingPayment] = await db
					.select()
					.from(payments)
					.where(
						and(
							eq(payments.leaseId, input.leaseId),
							eq(payments.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existingPayment) {
					return { payment: existingPayment };
				}
			}

			if (utilityId) {
				const due = await getAmountDueForUtility(db, utilityId);
				if (input.amount !== due) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Payment must equal the outstanding utility balance of ${formatRupees(due)}. Advance payments are not supported.`,
					});
				}
			} else if (input.type === PAYMENT_TYPES.RENT) {
				const due = await getAmountDueForRent(db, input.leaseId);
				if (input.amount !== due) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Payment must equal the outstanding rent balance of ${formatRupees(due)}. Advance payments are not supported.`,
					});
				}
			}
			let newPayment: typeof payments.$inferSelect | undefined;
			try {
				[newPayment] = await db
					.insert(payments)
					.values({
						leaseId: input.leaseId,
						amount: input.amount,
						paymentDate: input.paymentDate,
						type: input.type ?? PAYMENT_TYPES.RENT,
						paymentMethods: input.paymentMethods ?? null,
						referenceNumber: input.referenceNumber ?? null,
						description: input.description ?? null,
						utilityId,
						idempotencyKey,
					})
					.returning();
			} catch (error) {
				if (!isUniqueViolation(error)) throw error;
			}
			if (!newPayment && idempotencyKey) {
				const [existingPayment] = await db
					.select()
					.from(payments)
					.where(
						and(
							eq(payments.leaseId, input.leaseId),
							eq(payments.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existingPayment) {
					return { payment: existingPayment };
				}
			}
			payment = newPayment;
			if (utilityId && payment) {
				const dueAfter = await getAmountDueForUtility(db, utilityId);
				await db
					.update(utilities)
					.set({ isPaid: dueAfter <= 0 })
					.where(eq(utilities.id, utilityId));
			}
		} else {
			payment = await db.transaction(async (tx) => {
				if (utilityId) {
					await tx.execute(
						sql`select 1 from ${utilities} where ${utilities.id} = ${utilityId} for update`,
					);
				} else {
					await tx.execute(
						sql`select 1 from ${leases} where ${leases.id} = ${input.leaseId} for update`,
					);
				}

				if (idempotencyKey) {
					const [existingPayment] = await tx
						.select()
						.from(payments)
						.where(
							and(
								eq(payments.leaseId, input.leaseId),
								eq(payments.idempotencyKey, idempotencyKey),
							),
						)
						.limit(1);
					if (existingPayment) return existingPayment;
				}

				if (utilityId) {
					const due = await getAmountDueForUtility(tx, utilityId);
					if (input.amount !== due) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Payment must equal the outstanding utility balance of ${formatRupees(due)}. Advance payments are not supported.`,
						});
					}
				} else if (input.type === PAYMENT_TYPES.RENT) {
					const due = await getAmountDueForRent(tx, input.leaseId);
					if (input.amount !== due) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Payment must equal the outstanding rent balance of ${formatRupees(due)}. Advance payments are not supported.`,
						});
					}
				}

				const [newPayment] = await tx
					.insert(payments)
					.values({
						leaseId: input.leaseId,
						amount: input.amount,
						paymentDate: input.paymentDate,
						type: input.type ?? PAYMENT_TYPES.RENT,
						paymentMethods: input.paymentMethods ?? null,
						referenceNumber: input.referenceNumber ?? null,
						description: input.description ?? null,
						utilityId,
						idempotencyKey,
					})
					.returning();

				if (utilityId) {
					const dueAfter = await getAmountDueForUtility(tx, utilityId);
					await tx
						.update(utilities)
						.set({ isPaid: dueAfter <= 0 })
						.where(eq(utilities.id, utilityId));
				}

				return newPayment;
			});
		}

		if (!payment) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record payment",
			});
		}

		await sendAutomaticPaymentReceipt(db, authUser.id, payment.id);

		return { payment };
	});

// Create a single payment group for a combined agreement. Each active lease is
// allocated its complete currently-outstanding rent, preventing arbitrary or
// cross-unit splits while multi-unit partial-payment rules remain out of scope.
export const createAgreementPayment = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/create-agreement-payment",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateAgreementPaymentSchema)
	.output(
		z.object({
			paymentGroup: PaymentGroupSelectSchema,
			payments: z.array(PaymentSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		assertMethodAllowedForRole(input.paymentMethods, "owner");

		const [agreement] = await db
			.select({
				id: leaseAgreements.id,
				arrangementType: leaseAgreements.arrangementType,
			})
			.from(leaseAgreements)
			.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
			.where(
				and(
					eq(leaseAgreements.id, input.agreementId),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);
		if (!agreement) {
			throw new ORPCError("NOT_FOUND", {
				message: "Agreement not found or you do not own it",
			});
		}
		if (agreement.arrangementType !== LEASE_AGREEMENT_ARRANGEMENT.COMBINED) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Grouped payments are only available for combined agreements",
			});
		}

		const agreementLeases = await db
			.select({ id: leases.id })
			.from(leases)
			.where(
				and(eq(leases.agreementId, agreement.id), eq(leases.status, "active")),
			);
		if (agreementLeases.length < 2) {
			throw new ORPCError("BAD_REQUEST", {
				message: "A combined agreement requires at least two active leases",
			});
		}

		const allocations = await Promise.all(
			agreementLeases.map(async ({ id }) => ({
				leaseId: id,
				amount: await getAmountDueForRent(db, id),
			})),
		);
		if (allocations.some(({ amount }) => amount <= 0)) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Every active unit must have an outstanding rent balance for an automatic split",
			});
		}

		// Idempotency: one key across the group's lease allocations. The partial
		// unique index (lease_id, idempotency_key) rejects a retried group write.
		const idempotencyKey = input.idempotencyKey ?? null;
		if (idempotencyKey) {
			const [existingGroupPayment] = await db
				.select({ paymentGroupId: payments.paymentGroupId })
				.from(payments)
				.where(eq(payments.idempotencyKey, idempotencyKey))
				.limit(1);
			if (existingGroupPayment?.paymentGroupId) {
				const [paymentGroup] = await db
					.select()
					.from(paymentGroups)
					.where(eq(paymentGroups.id, existingGroupPayment.paymentGroupId));
				const createdPayments = await db
					.select()
					.from(payments)
					.where(
						eq(payments.paymentGroupId, existingGroupPayment.paymentGroupId),
					);
				if (paymentGroup) {
					return { paymentGroup, payments: createdPayments };
				}
			}
		}

		const groupId = crypto.randomUUID();
		const groupValues = {
			id: groupId,
			agreementId: agreement.id,
			paymentDate: input.paymentDate,
			paymentMethods: input.paymentMethods ?? null,
			referenceNumber: input.referenceNumber ?? null,
			description: input.description ?? null,
		};
		const paymentValues = allocations.map(({ leaseId, amount }) => ({
			leaseId,
			amount,
			paymentDate: input.paymentDate,
			paymentMethods: input.paymentMethods ?? null,
			referenceNumber: input.referenceNumber ?? null,
			type: PAYMENT_TYPES.RENT,
			description: input.description ?? null,
			paymentGroupId: groupId,
			idempotencyKey,
		}));

		if (supportsBatch(db)) {
			try {
				await db.batch([
					db.insert(paymentGroups).values(groupValues),
					...paymentValues.map((values) => db.insert(payments).values(values)),
				]);
			} catch (error) {
				if (!isUniqueViolation(error) || !idempotencyKey) throw error;
				// Concurrent retry won the race — return the winner's group.
				const [winnerPayment] = await db
					.select({ paymentGroupId: payments.paymentGroupId })
					.from(payments)
					.where(eq(payments.idempotencyKey, idempotencyKey))
					.limit(1);
				if (winnerPayment?.paymentGroupId) {
					const [paymentGroup] = await db
						.select()
						.from(paymentGroups)
						.where(eq(paymentGroups.id, winnerPayment.paymentGroupId));
					const createdPayments = await db
						.select()
						.from(payments)
						.where(eq(payments.paymentGroupId, winnerPayment.paymentGroupId));
					if (paymentGroup) {
						return { paymentGroup, payments: createdPayments };
					}
				}
				throw error;
			}
		} else {
			await db.transaction(async (tx) => {
				// Serialize concurrent grouped payments for the same agreement leases.
				for (const { leaseId } of allocations) {
					await tx.execute(
						sql`select 1 from ${leases} where ${leases.id} = ${leaseId} for update`,
					);
				}
				await tx.insert(paymentGroups).values(groupValues);
				await tx.insert(payments).values(paymentValues);
			});
		}

		const [paymentGroup] = await db
			.select()
			.from(paymentGroups)
			.where(eq(paymentGroups.id, groupId));
		const createdPayments = await db
			.select()
			.from(payments)
			.where(eq(payments.paymentGroupId, groupId));
		try {
			await db.insert(notifications).values({
				userId: agreementLeases[0]
					? ((
							await db
								.select({ tenantId: leases.tenantId })
								.from(leases)
								.where(eq(leases.id, agreementLeases[0].id))
								.limit(1)
						)[0]?.tenantId ?? authUser.id)
					: authUser.id,
				type: "grouped_payment_received",
				title: "Combined payment recorded",
				message:
					"A payment was recorded for every unit in your combined agreement.",
				entityId: groupId,
				entityType: "payment_group",
			});
		} catch (error) {
			console.error("[payment:createAgreementPayment] notification failed", {
				groupId,
				error,
			});
		}
		if (!paymentGroup || createdPayments.length !== paymentValues.length) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record grouped payment",
			});
		}
		await sendAutomaticAgreementPaymentReceipt(db, authUser.id, groupId);

		return { paymentGroup, payments: createdPayments };
	});

// Update — financial fields (amount, type, utilityId, leaseId) are immutable;
// only non-accounting metadata may change after a payment exists.
export const updatePayment = ownerProcedure
	.route({ method: "PATCH", path: "/rent/payment/update" })
	.input(z.object({ id: z.string(), data: UpdatePaymentSchema }))
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const existing = await getOwnedPayment(db, input.id, authUser.id);

		if (existing.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot update a reversal payment",
			});
		}

		// Recheck role restriction
		if (input.data.paymentMethods) {
			assertMethodAllowedForRole(input.data.paymentMethods, "owner");
		}

		const [updated] = await db
			.update(payments)
			.set({
				...input.data,
				paymentDate: input.data.paymentDate
					? new Date(input.data.paymentDate)
					: undefined,
				updatedAt: new Date(),
			})
			.where(eq(payments.id, input.id))
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment not found after update",
			});
		}
		return { payment: updated };
	});

// GetById
export const getPaymentById = ownerProcedure
	.route({ method: "GET", path: "/rent/payment/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const row = await getOwnedPayment(db, input.id, authUser.id);
		const { ownerId: _ownerId, ...payment } = row;

		return { payment };
	});

// GetAll
export const listPayments = ownerProcedure
	.route({ method: "GET", path: "/rent/payment/list" })
	.output(z.object({ payments: z.array(PaymentListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				id: payments.id,
				leaseId: payments.leaseId,
				amount: payments.amount,
				paymentDate: payments.paymentDate,
				paymentMethods: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				type: payments.type,
				description: payments.description,
				utilityId: payments.utilityId,
				createdAt: payments.createdAt,
				updatedAt: payments.updatedAt,
				paymentGroupId: payments.paymentGroupId,
				tenantName: user.name,
				tenantPhone: tenantProfiles.phone,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.leftJoin(
				tenantProfiles,
				and(
					eq(tenantProfiles.userId, user.id),
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.where(
				and(
					eq(properties.ownerId, authUser.id),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			)
			.orderBy(
				desc(payments.paymentDate),
				desc(payments.createdAt),
				desc(payments.id),
			);

		return { payments: results };
	});

// Remove — void creates negative reversal, preserves utilityId, blocks duplicate void
export const voidPayment = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/void" })
	.input(z.object({ id: z.string(), reason: z.string().optional() }))
	.output(z.object({ reversal: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const existing = await getOwnedPayment(db, input.id, authUser.id);

		if (existing.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot void a reversal payment",
			});
		}
		if (existing.paymentGroupId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Use voidPaymentGroup to reverse a grouped payment",
			});
		}

		// Duplicate-void guard: one reversal per original payment
		const [alreadyReversed] = await db
			.select({ id: payments.id })
			.from(payments)
			.where(
				and(
					eq(payments.type, PAYMENT_TYPES.REVERSAL),
					eq(payments.referenceNumber, existing.id),
				),
			)
			.limit(1);
		if (alreadyReversed) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment already voided",
			});
		}

		const utilityId = existing.utilityId;

		let reversal: typeof payments.$inferSelect | undefined;
		if (supportsBatch(db)) {
			const [reversalRow] = await db
				.insert(payments)
				.values({
					leaseId: existing.leaseId,
					amount: -existing.amount,
					paymentDate: new Date(),
					type: PAYMENT_TYPES.REVERSAL,
					description: input.reason ?? `Reversal of payment ${existing.id}`,
					referenceNumber: existing.id,
					utilityId,
				})
				.returning();
			reversal = reversalRow;
			if (utilityId && reversal) {
				const dueAfter = await getAmountDueForUtility(db, utilityId);
				await db
					.update(utilities)
					.set({ isPaid: dueAfter <= 0 })
					.where(eq(utilities.id, utilityId));
			}
		} else {
			reversal = await db.transaction(async (tx) => {
				const [reversalRow] = await tx
					.insert(payments)
					.values({
						leaseId: existing.leaseId,
						amount: -existing.amount,
						paymentDate: new Date(),
						type: PAYMENT_TYPES.REVERSAL,
						description: input.reason ?? `Reversal of payment ${existing.id}`,
						referenceNumber: existing.id,
						utilityId,
					})
					.returning();

				if (utilityId) {
					const dueAfter = await getAmountDueForUtility(tx, utilityId);
					await tx
						.update(utilities)
						.set({ isPaid: dueAfter <= 0 })
						.where(eq(utilities.id, utilityId));
				}

				return reversalRow;
			});
		}

		if (!reversal) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create reversal",
			});
		}

		return { reversal };
	});

// Reverse all allocations in one grouped operation. Grouped payments must not be
// reversed individually because that would make the shared payment record lie
// about which units were settled.
export const voidPaymentGroup = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/void-group" })
	.input(z.object({ id: z.uuid(), reason: z.string().optional() }))
	.output(
		z.object({
			paymentGroup: PaymentGroupSelectSchema,
			reversals: z.array(PaymentSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		const [originalGroup] = await db
			.select({
				id: paymentGroups.id,
				agreementId: paymentGroups.agreementId,
				paymentMethods: paymentGroups.paymentMethods,
				referenceNumber: paymentGroups.referenceNumber,
				description: paymentGroups.description,
				reversesPaymentGroupId: paymentGroups.reversesPaymentGroupId,
			})
			.from(paymentGroups)
			.innerJoin(
				leaseAgreements,
				eq(paymentGroups.agreementId, leaseAgreements.id),
			)
			.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
			.where(
				and(
					eq(paymentGroups.id, input.id),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);
		if (!originalGroup) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment group not found or you do not own it",
			});
		}
		if (originalGroup.reversesPaymentGroupId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot reverse a reversal group",
			});
		}

		const [alreadyReversed] = await db
			.select({ id: paymentGroups.id })
			.from(paymentGroups)
			.where(eq(paymentGroups.reversesPaymentGroupId, originalGroup.id))
			.limit(1);
		if (alreadyReversed) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment group already voided",
			});
		}

		const originalPayments = await db
			.select({
				id: payments.id,
				leaseId: payments.leaseId,
				amount: payments.amount,
				utilityId: payments.utilityId,
			})
			.from(payments)
			.where(eq(payments.paymentGroupId, originalGroup.id));
		if (originalPayments.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment group has no allocations to reverse",
			});
		}

		const reversalGroupId = crypto.randomUUID();
		const paymentDate = new Date();
		const reversalGroupValues = {
			id: reversalGroupId,
			agreementId: originalGroup.agreementId,
			paymentDate,
			paymentMethods: originalGroup.paymentMethods,
			referenceNumber: originalGroup.referenceNumber,
			description:
				input.reason ?? `Reversal of payment group ${originalGroup.id}`,
			reversesPaymentGroupId: originalGroup.id,
		};
		const reversalValues = originalPayments.map((payment) => ({
			leaseId: payment.leaseId,
			amount: -payment.amount,
			paymentDate,
			paymentMethods: originalGroup.paymentMethods,
			referenceNumber: payment.id,
			type: PAYMENT_TYPES.REVERSAL,
			description: input.reason ?? `Reversal of payment ${payment.id}`,
			utilityId: payment.utilityId,
			paymentGroupId: reversalGroupId,
		}));

		if (supportsBatch(db)) {
			await db.batch([
				db.insert(paymentGroups).values(reversalGroupValues),
				...reversalValues.map((values) => db.insert(payments).values(values)),
			]);
		} else {
			await db.transaction(async (tx) => {
				await tx.insert(paymentGroups).values(reversalGroupValues);
				await tx.insert(payments).values(reversalValues);
			});
		}

		const [paymentGroup] = await db
			.select()
			.from(paymentGroups)
			.where(eq(paymentGroups.id, reversalGroupId));
		const reversals = await db
			.select()
			.from(payments)
			.where(eq(payments.paymentGroupId, reversalGroupId));
		if (!paymentGroup || reversals.length !== reversalValues.length) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to reverse grouped payment",
			});
		}

		// Grouped reversals may reopen utility bills — keep the compatibility
		// isPaid flag in sync with the derived amountDue (parity with voidPayment).
		const utilityIds = [
			...new Set(
				originalPayments
					.map((payment) => payment.utilityId)
					.filter((id): id is string => Boolean(id)),
			),
		];
		for (const utilityId of utilityIds) {
			const dueAfter = await getAmountDueForUtility(db, utilityId);
			await db
				.update(utilities)
				.set({ isPaid: dueAfter <= 0 })
				.where(eq(utilities.id, utilityId));
		}

		return { paymentGroup, reversals };
	});

export const sendPaymentReceipt = ownerProcedure
	.route({ method: "POST", path: "/rent/payment/send-receipt" })
	.input(z.object({ paymentId: z.string().min(1) }))
	.output(z.object({ sent: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		if (!workspaceCapabilities(authUser).outboundCommunication) {
			return { sent: false };
		}

		// single query for ownership check AND data retrieval.
		// The innerJoin on properties.ownerId already enforces authorization —
		// if this payment doesn't belong to the owner, the result is empty.
		const [result] = await db
			.select({
				amount: payments.amount,
				paymentGroupId: payments.paymentGroupId,
				paymentDate: payments.paymentDate,
				type: payments.type,
				paymentMethods: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				tenantEmail: user.email,
				tenantName: user.name,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(
				and(
					eq(payments.id, input.paymentId),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);

		if (!result) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment not found or you do not have access to it.",
			});
		}

		// Manual delivery uses the same specialized HTML template as automatic
		// receipts. The payment already happened; the receipt is independent of
		// the persistence transaction.
		if (result.paymentGroupId) {
			const allocations = await db
				.select({ unitNumber: units.unitNumber, amount: payments.amount })
				.from(payments)
				.innerJoin(leases, eq(payments.leaseId, leases.id))
				.innerJoin(units, eq(leases.unitId, units.id))
				.where(eq(payments.paymentGroupId, result.paymentGroupId));
			await sendAgreementPaymentReceiptEmail({
				to: result.tenantEmail,
				tenantName: result.tenantName,
				ownerName: authUser.name,
				propertyName: result.propertyName,
				paymentDate: result.paymentDate,
				paymentMethod: result.paymentMethods,
				referenceNumber: result.referenceNumber,
				allocations,
			});
		} else
			await sendPaymentReceiptEmail({
				to: result.tenantEmail,
				tenantName: result.tenantName,
				ownerName: authUser.name,
				propertyName: result.propertyName,
				unitNumber: result.unitNumber,
				amount: result.amount,
				paymentDate: result.paymentDate,
				paymentType: result.type,
				paymentMethod: result.paymentMethods,
				referenceNumber: result.referenceNumber,
			});

		return { sent: true };
	});
