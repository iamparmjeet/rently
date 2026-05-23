import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import {
	leases,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	CreatePaymentSchema,
	PaymentSelectSchema,
	UpdatePaymentSchema,
} from "@rently/validators";
import { eq } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";

// ─── Shared helper ───────────────────────────────────────────────────────────
// Fetches a payment + walks the JOIN chain to get ownerId for auth
async function getOwnedPayment(
	db: import("@rently/db").Database,
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
		throw new ORPCError(StatusPhrase.NOT_FOUND, {
			message: "Payment not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError(StatusPhrase.FORBIDDEN, {
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
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not own this lease",
			});
		}

		// Transaction: insert payment + conditionally mark utility as paid
		// Why a transaction? If the utility update fails, we don't want a
		// dangling payment record pointing at an unpaid utility.

		const payment = await db.transaction(async (tx) => {
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
					utilityId: input.utilityId ?? null,
				})
				.returning();

			if (!newPayment) {
				throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
					message: "Failed to record payment",
				});
			}

			// Side- effect: Mark as paid if this payment covers
			if (newPayment.utilityId) {
				await tx
					.update(utilities)
					.set({ isPaid: true })
					.where(eq(utilities.id, newPayment.utilityId));
			}
			return newPayment;
		});
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
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
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
	.output(z.object({ payments: z.array(PaymentSelectSchema) }))
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
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(eq(properties.ownerId, authUser.id));

		return { payments: results };
	});

// Remove
export const deletePayment = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/delete" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// need UtilityId before deleting
		const existing = await getOwnedPayment(db, input.id, authUser.id);

		await db.transaction(async (tx) => {
			await tx.delete(payments).where(eq(payments.id, input.id));

			// Reverse the side effect - if this payment covered a utility, unmark it
			if (existing.utilityId) {
				await tx
					.update(utilities)
					.set({ isPaid: false })
					.where(eq(utilities.id, existing.utilityId));
			}
		});

		return { success: true };
	});
