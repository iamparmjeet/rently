import type { Database } from "@rently/db";
import {
	PAYMENT_TYPES,
	type PaymentType,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { and, eq, gte, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

type DbReader = Pick<Database, "select">;

const ledgerTenant = alias(user, "signed_ledger_tenant");
const originalPayment = alias(payments, "signed_ledger_original");

export type SignedLedgerScope = {
	paymentIds?: string[];
	leaseIds?: string[];
	utilityIds?: string[];
	ownerId?: string;
	tenantId?: string;
	from?: Date;
	to?: Date;
};

export type SignedLedgerPayment = {
	id: string;
	leaseId: string;
	utilityId: string | null;
	amount: number;
	paymentDate: Date;
	paymentMethods: string | null;
	referenceNumber: string | null;
	type: PaymentType;
	description: string | null;
	createdAt: Date;
	updatedAt: Date;
	paymentGroupId: string | null;
	reversesPaymentId: string | null;
	category: PaymentType | null;
	isReversal: boolean;
	isReversed: boolean;
	tenantName: string;
	tenantPhone: string | null;
	propertyName: string;
	unitNumber: string;
	utilityType: string | null;
};

function reversalOriginalLink() {
	// B03 links new reversals by FK. The reference-number branch preserves
	// read compatibility for historical rows whose nullable FK is still empty.
	return and(
		eq(payments.type, PAYMENT_TYPES.REVERSAL),
		eq(originalPayment.leaseId, payments.leaseId),
		or(
			eq(originalPayment.id, payments.reversesPaymentId),
			and(
				isNull(payments.reversesPaymentId),
				sql`${payments.referenceNumber} = ${originalPayment.id}::text`,
			),
		),
	);
}

function hasReversalExpression() {
	return sql<boolean>`exists (
		select 1
		from ${payments} reversal
		where reversal.type = ${PAYMENT_TYPES.REVERSAL}
			and (
				reversal.reverses_payment_id = ${payments.id}
				or (
					reversal.reverses_payment_id is null
					and reversal.reference_number = ${payments.id}::text
				)
			)
	)`;
}

function scopedConditions(scope: SignedLedgerScope): SQL[] {
	return [
		scope.paymentIds ? inArray(payments.id, scope.paymentIds) : undefined,
		scope.leaseIds ? inArray(payments.leaseId, scope.leaseIds) : undefined,
		scope.utilityIds
			? inArray(payments.utilityId, scope.utilityIds)
			: undefined,
		scope.ownerId ? eq(properties.ownerId, scope.ownerId) : undefined,
		scope.tenantId ? eq(leases.tenantId, scope.tenantId) : undefined,
		scope.from ? gte(payments.paymentDate, scope.from) : undefined,
		scope.to ? sql`${payments.paymentDate} < ${scope.to}` : undefined,
	].filter((condition): condition is SQL => condition !== undefined);
}

/**
 * Read payment rows as one signed ledger. `amount` is never re-signed: the
 * write path stores positive settlements and negative reversal rows. A
 * reversal's category comes only from its linked original, so a deposit or
 * utility reversal cannot leak into rent totals.
 */
export async function getSignedLedgerPayments(
	db: DbReader,
	scope: SignedLedgerScope = {},
): Promise<SignedLedgerPayment[]> {
	if (
		scope.paymentIds?.length === 0 ||
		scope.leaseIds?.length === 0 ||
		scope.utilityIds?.length === 0
	) {
		return [];
	}

	const conditions = scopedConditions(scope);
	const rows = await db
		.select({
			id: payments.id,
			leaseId: payments.leaseId,
			utilityId: payments.utilityId,
			amount: payments.amount,
			paymentDate: payments.paymentDate,
			paymentMethods: payments.paymentMethods,
			referenceNumber: payments.referenceNumber,
			type: payments.type,
			description: payments.description,
			createdAt: payments.createdAt,
			updatedAt: payments.updatedAt,
			paymentGroupId: payments.paymentGroupId,
			reversesPaymentId: payments.reversesPaymentId,
			originalType: originalPayment.type,
			isReversed: hasReversalExpression(),
			tenantName: ledgerTenant.name,
			tenantPhone: ledgerTenant.phone,
			propertyName: properties.name,
			unitNumber: units.unitNumber,
			utilityType: utilities.utilityType,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(ledgerTenant, eq(leases.tenantId, ledgerTenant.id))
		.leftJoin(utilities, eq(payments.utilityId, utilities.id))
		.leftJoin(originalPayment, reversalOriginalLink())
		.where(conditions.length > 0 ? and(...conditions) : undefined);

	return rows.map((row) => ({
		...row,
		category: row.type === PAYMENT_TYPES.REVERSAL ? row.originalType : row.type,
		isReversal: row.type === PAYMENT_TYPES.REVERSAL,
	}));
}
