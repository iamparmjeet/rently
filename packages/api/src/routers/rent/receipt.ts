import { ORPCError } from "@orpc/server";
import { ownerProcedure, protectedProcedure } from "@rently/api/procedures";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	ownerProfiles,
	payments,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generateReceiptNumber } from "@rently/db/utils/receipt";
import { PaymentReceiptDataSchema } from "@rently/validators";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";

const tenantUser = alias(user, "receipt_tenant");

const PaymentReceiptOutputSchema = z.object({
	receipt: PaymentReceiptDataSchema,
});

async function findReceipt(
	db: import("@rently/db").Database,
	paymentId: string,
	scope: SQL,
) {
	const [row] = await db
		.select({
			paymentId: payments.id,
			amount: payments.amount,
			paymentDate: payments.paymentDate,
			paymentType: payments.type,
			paymentMethods: payments.paymentMethods,
			referenceNumber: payments.referenceNumber,
			description: payments.description,

			leaseId: leases.id,
			leaseRent: leases.rent,
			leaseStartDate: leases.startDate,
			leaseEndDate: leases.endDate,

			propertyName: properties.name,
			propertyAddress: properties.address,

			unitNumber: units.unitNumber,

			tenantName: tenantUser.name,
			tenantAddress: tenantProfiles.address,

			ownerName: user.name,
			ownerCompanyName: ownerProfiles.companyName,
			ownerAddress: ownerProfiles.address,
			ownerGstNumber: ownerProfiles.gstNumber,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(properties.ownerId, user.id))
		.innerJoin(tenantUser, eq(leases.tenantId, tenantUser.id))
		.leftJoin(
			ownerProfiles,
			and(eq(ownerProfiles.userId, user.id), isNull(ownerProfiles.deletedAt)),
		)
		.leftJoin(
			tenantProfiles,
			and(
				eq(tenantProfiles.userId, tenantUser.id),
				isNull(tenantProfiles.deletedAt),
			),
		)
		.where(and(eq(payments.id, paymentId), scope))
		.limit(1);

	return row;
}

function toReceipt(row: NonNullable<Awaited<ReturnType<typeof findReceipt>>>) {
	if (row.paymentType === PAYMENT_TYPES.REVERSAL) {
		throw new ORPCError("BAD_REQUEST", {
			message: "A receipt cannot be generated for a reversal.",
		});
	}

	return {
		receiptNumber: generateReceiptNumber(row.paymentId),
		payment: {
			id: row.paymentId,
			amount: row.amount,
			paymentDate: row.paymentDate,
			type: row.paymentType,
			paymentMethods: row.paymentMethods,
			referenceNumber: row.referenceNumber,
			description: row.description,
		},
		lease: {
			id: row.leaseId,
			rent: row.leaseRent,
			startDate: row.leaseStartDate,
			endDate: row.leaseEndDate,
		},
		property: {
			name: row.propertyName,
			address: row.propertyAddress,
		},
		unit: {
			unitNumber: row.unitNumber,
		},
		tenant: {
			name: row.tenantName,
			address: row.tenantAddress,
		},
		owner: {
			name: row.ownerName,
			companyName: row.ownerCompanyName,
			address: row.ownerAddress,
			gstNumber: row.ownerGstNumber,
		},
	};
}

export const getPaymentReceiptData = ownerProcedure
	.route({ method: "GET", path: "/rent/payment/receipt" })
	.input(z.object({ paymentId: z.uuid() }))
	.output(PaymentReceiptOutputSchema)
	.handler(async ({ context, input }) => {
		const row = await findReceipt(
			context.db,
			input.paymentId,
			eq(properties.ownerId, context.user.id),
		);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment receipt not found.",
			});
		}

		return { receipt: toReceipt(row) };
	});

export const getMyPaymentReceiptData = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/payment-receipt" })
	.input(z.object({ paymentId: z.uuid() }))
	.output(PaymentReceiptOutputSchema)
	.handler(async ({ context, input }) => {
		const row = await findReceipt(
			context.db,
			input.paymentId,
			eq(leases.tenantId, context.user.id),
		);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment receipt not found.",
			});
		}

		return { receipt: toReceipt(row) };
	});
