import { ORPCError } from "@orpc/server";
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
import { sendCustomEmailToTenant } from "@rently/email";
import {
	CreatePaymentSchema,
	PaymentListItemSchema,
	PaymentSelectSchema,
	UpdatePaymentSchema,
} from "@rently/validators";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
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

// Create
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

		const ownsLease = await isLeaseOwner(db, authUser.id, input.leaseId);
		if (!ownsLease) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this lease",
			});
		}

		assertMethodAllowedForRole(input.paymentMethods, "owner");

		const createPaymentQuery = db
			.insert(payments)
			.values({
				leaseId: input.leaseId,
				amount: input.amount,
				paymentDate: input.paymentDate,
				type: input.type ?? PAYMENT_TYPES.RENT,
				paymentMethods: input.paymentMethods ?? null,
				referenceNumber: input.referenceNumber ?? null,
				description: input.description ?? null,
				utilityId: input.utilityId ?? null,
			})
			.returning();

		let payment: Awaited<typeof createPaymentQuery>[number] | undefined;
		const utilityId = input.utilityId ?? null;

		if (!utilityId) {
			[payment] = await createPaymentQuery;
		} else if (supportsBatch(db)) {
			const [createdPayments] = await db.batch([
				createPaymentQuery,
				db
					.update(utilities)
					.set({ isPaid: true })
					.where(eq(utilities.id, utilityId)),
			]);
			payment = createdPayments[0];
		} else {
			payment = await db.transaction(async (tx) => {
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

				await tx
					.update(utilities)
					.set({ isPaid: true })
					.where(eq(utilities.id, utilityId));

				return newPayment;
			});
		}

		if (!payment) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record payment",
			});
		}

		return { payment };
	});

// Update
export const updatePayment = ownerProcedure
	.route({ method: "PATCH", path: "/rent/payment/update" })
	.input(z.object({ id: z.string(), data: UpdatePaymentSchema }))
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// getOwnedPayment does find + auth check
		await getOwnedPayment(db, input.id, authUser.id);

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
				tenantName: user.name,
				tenantPhone: tenantProfiles.phone,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.leftJoin(tenantProfiles, eq(tenantProfiles.userId, user.id))
			.where(eq(properties.ownerId, authUser.id));

		return { payments: results };
	});

// Remove
export const voidPayment = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/void" })
	.input(z.object({ id: z.string(), reason: z.string().optional() }))
	.output(z.object({ reversal: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// need UtilityId before deleting
		const existing = await getOwnedPayment(db, input.id, authUser.id);

		const createReversalQuery = db
			.insert(payments)
			.values({
				leaseId: existing.leaseId,
				amount: -existing.amount,
				paymentDate: new Date(),
				type: "reversal",
				description: input.reason ?? `Reversal of payment ${existing.id}`,
				referenceNumber: existing.id,
				utilityId: null,
			})
			.returning();

		let reversal: Awaited<typeof createReversalQuery>[number] | undefined;
		const utilityId = existing.utilityId;

		if (!utilityId) {
			[reversal] = await createReversalQuery;
		} else if (supportsBatch(db)) {
			const [reversalRows] = await db.batch([
				createReversalQuery,
				db
					.update(utilities)
					.set({ isPaid: false })
					.where(eq(utilities.id, utilityId)),
			]);
			reversal = reversalRows[0];
		} else {
			reversal = await db.transaction(async (tx) => {
				const [reversalRow] = await tx
					.insert(payments)
					.values({
						leaseId: existing.leaseId,
						amount: -existing.amount,
						paymentDate: new Date(),
						type: "reversal",
						description: input.reason ?? `Reversal of payment ${existing.id}`,
						referenceNumber: existing.id,
						utilityId: null,
					})
					.returning();

				await tx
					.update(utilities)
					.set({ isPaid: false })
					.where(eq(utilities.id, utilityId));

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

function fmtPaise(paise: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(paise / 100);
}

function buildReceiptMessage({
	tenantName,
	type,
	amount,
	paymentDate,
	paymentMethods,
	referenceNumber,
}: {
	tenantName: string;
	type: string;
	amount: number;
	paymentDate: Date;
	paymentMethods: string | null;
	referenceNumber: string | null;
}): string {
	const date = new Date(paymentDate).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
	const method = paymentMethods?.replace("_", " ") ?? "—";
	const ref = referenceNumber ?? "—";
	const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

	return [
		`Dear ${tenantName},`,
		"",
		"This is a confirmation that we have received your payment.",
		"",
		"Payment Details:",
		`• Type    : ${typeLabel}`,
		`• Amount  : ${fmtPaise(amount)}`,
		`• Date    : ${date}`,
		`• Method  : ${method}`,
		`• Ref #   : ${ref}`,
		"",
		"Thank you for your timely payment.",
		"– KeyHQ",
	].join("\n");
}

export const sendPaymentReceipt = ownerProcedure
	.route({ method: "POST", path: "/rent/payment/send-receipt" })
	.input(z.object({ paymentId: z.string().min(1) }))
	.output(z.object({ sent: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

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

		// consistent with the invite/sendEmailToTenant pattern — email
		// failure is logged and surfaced as an error response but does not
		//  corrupt the payment record. The payment already happened; the
		//  receipt is a notification, not a side-effect of the transaction.
		await sendCustomEmailToTenant({
			to: result.tenantEmail,
			tenantName: result.tenantName,
			ownerName: authUser.name,
			subject: `Payment Receipt — ${fmtPaise(result.amount)}`,
			message: buildReceiptMessage(result),
		});

		return { sent: true };
	});
