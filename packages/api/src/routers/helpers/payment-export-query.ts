import { nextIndianDateStart, startOfIndianDate } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { leases, payments, properties, units } from "@rently/db/schema/schema";
import type { PaymentExportRange, PaymentExportRow } from "@rently/validators";
import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";

export const PAYMENT_EXPORT_MAX_ROWS = 10_000;

type PaymentExportScope =
	| {
			kind: "owner";
			ownerId: string;
			range: PaymentExportRange;
	  }
	| {
			kind: "tenant";
			ownerId: string;
			tenantId: string;
	  };

async function queryPaymentExportRows(
	db: Database,
	scope: PaymentExportScope,
): Promise<PaymentExportRow[]> {
	const conditions: SQL[] = [eq(properties.ownerId, scope.ownerId)];

	if (scope.kind === "owner") {
		conditions.push(
			gte(payments.paymentDate, startOfIndianDate(scope.range.startDate)),
			lt(payments.paymentDate, nextIndianDateStart(scope.range.endDate)),
		);
	}

	if (scope.kind === "tenant") {
		conditions.push(eq(leases.tenantId, scope.tenantId));
	}

	return db
		.select({
			id: payments.id,
			paymentDate: payments.paymentDate,
			type: payments.type,
			amount: payments.amount,
			paymentMethods: payments.paymentMethods,
			referenceNumber: payments.referenceNumber,
			description: payments.description,
			tenantName: user.name,
			propertyName: properties.name,
			unitNumber: units.unitNumber,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(leases.tenantId, user.id))
		.where(and(...conditions))
		.orderBy(
			desc(payments.paymentDate),
			desc(payments.createdAt),
			desc(payments.id),
		)
		.limit(PAYMENT_EXPORT_MAX_ROWS + 1);
}

export function queryOwnerPaymentExportRows(
	db: Database,
	ownerId: string,
	range: PaymentExportRange,
): Promise<PaymentExportRow[]> {
	return queryPaymentExportRows(db, {
		kind: "owner",
		ownerId,
		range,
	});
}

export function queryTenantPaymentExportRows(
	db: Database,
	ownerId: string,
	tenantId: string,
): Promise<PaymentExportRow[]> {
	return queryPaymentExportRows(db, {
		kind: "tenant",
		ownerId,
		tenantId,
	});
}
