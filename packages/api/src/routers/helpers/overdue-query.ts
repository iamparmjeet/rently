import type { Database } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { leases, properties, units } from "@rently/db/schema/schema";
import type { OverdueLease } from "@rently/validators";
import { and, eq, isNull } from "drizzle-orm";
import { computeLeaseOverdue } from "./overdue";
import { readChargeOutstandingRows } from "./period-balance";
import { getLocalDateKey } from "./rent-cycle";

// C08 cutover: the overdue list reads the period ledger (per-charge due dates
// and outstanding paise), not the lifetime heuristic. Pure read — no accrual
// here; the nightly reminder job keeps the charge set fresh, and the C05
// balance read model accrues on its own reads.
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

	const leaseIds = rows.map((row) => row.leaseId);
	const chargeRows = await readChargeOutstandingRows(db, leaseIds);
	const localToday = getLocalDateKey(now);

	return rows.flatMap((row) => {
		// Active-lease filter is already applied; computeLeaseOverdue aggregates
		// every past-due charge into one state anchored on the earliest one, so
		// historical arrears surface without inventing per-period noise (R13).
		const state = computeLeaseOverdue(
			chargeRows.filter((charge) => charge.leaseId === row.leaseId),
			row.startDate,
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
				paidAmount: state.paidAmount,
				outstandingAmount: state.outstandingAmount,
				dueDate: state.dueDate,
				daysOverdue: state.daysOverdue,
			},
		];
	});
}
