import { ORPCError } from "@orpc/server";
import { workspaceCapabilities } from "@rently/api/modules/sample-workspace";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { OWNER_ONLY_PAYMENT_METHODS_VALUE } from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import type { UserRole } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	payments,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { sendPaymentReceiptEmail } from "@rently/email";
import {
	CreatePaymentSchema,
	PaymentListItemSchema,
	PaymentSelectSchema,
	UpdatePaymentSchema,
} from "@rently/validators";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";
import { sendAutomaticPaymentReceipt } from "../helpers/automatic-emails";
import {
	getAmountDueForRent,
	getAmountDueForUtility,
} from "../helpers/credit.helpers";

// ─── Shared helper ─────
function assertMethodAllowedForRole(
	method: string | null | undefined,
	role: UserRole,
) {
	if (!method) return;
	const isOwnerOnly = (
		OWNER_ONLY_PAYMENT_METHODS_VALUE as readonly string[]
	).includes(method);

	if (!isOwnerOnly && role !== "owner") {
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

		if (input.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Reversal payments must use voidPayment",
			});
		}

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

		// Single tx: validate amount === derived due and keep isPaid compat
		const payment = await db.transaction(async (tx) => {
			if (utilityId) {
				const due = await getAmountDueForUtility(tx, utilityId);
				if (input.amount !== due) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Amount must equal outstanding amountDue (${due}) for this utility`,
					});
				}
			} else if (input.type === PAYMENT_TYPES.RENT) {
				const due = await getAmountDueForRent(tx, input.leaseId);
				if (input.amount !== due) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Amount must equal outstanding rent due (${due})`,
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
				})
				.returning();

			// Keep boolean isPaid in sync for legacy reads — derived is amountDue<=0
			if (utilityId) {
				const dueAfter = await getAmountDueForUtility(tx, utilityId);
				await tx
					.update(utilities)
					.set({ isPaid: dueAfter <= 0 })
					.where(eq(utilities.id, utilityId));
			}

			return newPayment;
		});

		if (!payment) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record payment",
			});
		}

		await sendAutomaticPaymentReceipt(db, authUser.id, payment.id);

		return { payment };
	});

// Update — re-validate utility linkage and block reversal via update
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
		if (input.data.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Use voidPayment to create reversals",
			});
		}

		// Recheck role restriction
		if (input.data.paymentMethods) {
			assertMethodAllowedForRole(input.data.paymentMethods, "owner");
		}

		// If caller changes utilityId, re-verify ownership of that utility's lease
		const nextUtilityId = (input.data as { utilityId?: string | null })
			.utilityId;
		if (nextUtilityId !== undefined && nextUtilityId !== null) {
			const [util] = await db
				.select({ leaseId: utilities.leaseId })
				.from(utilities)
				.where(eq(utilities.id, nextUtilityId))
				.limit(1);
			if (!util) {
				throw new ORPCError("NOT_FOUND", { message: "Utility not found" });
			}
			const ownsUtilityLease = await isLeaseOwner(
				db,
				authUser.id,
				util.leaseId,
			);
			if (!ownsUtilityLease) {
				throw new ORPCError("FORBIDDEN", {
					message: "You do not own the lease for this utility",
				});
			}
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
				tenantName: user.name,
				tenantPhone: tenantProfiles.phone,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.leftJoin(tenantProfiles, eq(tenantProfiles.userId, user.id))
			.where(eq(properties.ownerId, authUser.id))
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

		const reversal = await db.transaction(async (tx) => {
			const [reversalRow] = await tx
				.insert(payments)
				.values({
					leaseId: existing.leaseId,
					amount: -existing.amount,
					paymentDate: new Date(),
					type: PAYMENT_TYPES.REVERSAL,
					description: input.reason ?? `Reversal of payment ${existing.id}`,
					referenceNumber: existing.id,
					utilityId, // preserve linkage — audit keeps bill relation
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

		if (!reversal) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create reversal",
			});
		}

		return { reversal };
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
