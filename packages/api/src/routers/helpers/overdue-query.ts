import type { Database } from "@rently/db";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import { leases, payments, properties, units } from "@rently/db/schema/schema";
import type { OverdueLease } from "@rently/validators";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { computeOverdueState } from "./overdue";
import { getLocalDateKey, getLocalPeriodKey } from "./rent-cycle";

export async function queryOverdueLeases(
	db: Database,
	now: Date,
	ownerId: string,
): Promise<OverdueLease[]> {
	const rows = await db
		.select({
			leaseId: leases.id,
			tenantId: leases.tenantId,
			tenantName: user.name,
			propertyName: properties.name,
			unitNumber: units.unitNumber,
			rent: leases.rent,
			startDate: leases.startDate,
			endDate: leases.endDate,
			rentDueDate: leases.rentDueDate,
			leaseStatus: leases.status,
		})
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(leases.tenantId, user.id))
		.where(
			and(
				eq(properties.ownerId, ownerId),
				isNull(properties.deletedAt),
				isNull(units.deletedAt),
				eq(leases.status, "active"),
			),
		);

	if (rows.length === 0) return [];

	const periodKey = getLocalPeriodKey(now);
	const leaseIds = rows.map((row) => row.leaseId);
	const paymentRows = await db
		.select({
			leaseId: payments.leaseId,
			amount: payments.amount,
			paymentDate: payments.paymentDate,
			type: payments.type,
		})
		.from(payments)
		.where(inArray(payments.leaseId, leaseIds));

	const paidByLease = new Map<string, number>();
	for (const payment of paymentRows) {
		if (
			payment.type !== PAYMENT_TYPES.RENT ||
			getLocalPeriodKey(payment.paymentDate) !== periodKey
		) {
			continue;
		}

		paidByLease.set(
			payment.leaseId,
			(paidByLease.get(payment.leaseId) ?? 0) + payment.amount,
		);
	}

	const localToday = getLocalDateKey(now);

	return rows.flatMap((row) => {
		const state = computeOverdueState(
			{
				...row,
				paidAmount: paidByLease.get(row.leaseId) ?? 0,
			},
			localToday,
		);

		if (!state) return [];

		return [
			{
				leaseId: row.leaseId,
				tenantId: row.tenantId,
				tenantName: row.tenantName,
				propertyName: row.propertyName,
				unitNumber: row.unitNumber,
				rent: row.rent,
				...state,
			},
		];
	});
}
