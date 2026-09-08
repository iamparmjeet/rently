import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import {
	billCredits,
	leases,
	rentAllocations,
	rentCharges,
	utilities,
} from "@rently/db/schema/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbTx } from "./credit.helpers";
import { getAmountDueForUtility } from "./credit.helpers";
import {
	getLocalDateKey,
	getLocalPeriodKey,
	getNextLocalPeriodKey,
} from "./rent-cycle";
import { ensureAccruedChargesSql } from "./rent-period";
import { getSignedLedgerPayments } from "./signed-ledger";

// ── Period-aware balance read model (C05; rules in docs/Rent-Period-Rules.md) ──
// One owner/tenant-safe server model answering "what does this lease actually
// owe": per-period charges minus allocations (C02 sign convention — an
// allocation is the paise that SETTLES the charge), credits, paid amounts, and
// utilities. Since the C08 cutover this IS the production rent read: writers
// validate against it and reminders/overdue/statistics consume it — no
// lifetime rent read remains (getAmountDueForRent was removed with C08).
//
// Charges are ensured before reading: during the lazy-accrual phase (C04
// decision) charges appear at operation time, so a lease idle across a month
// boundary has no current-period row yet. R2–R5 define accrual from lease
// dates alone, so the read model creates missing charge rows first —
// `ensureAccruedChargesSql` is idempotent (ON CONFLICT DO NOTHING), so reads
// never duplicate or rewrite existing charges.

export type PeriodChargeView = {
	periodKey: string;
	dueDate: string;
	amount: number;
	allocated: number;
	outstanding: number;
	isPaid: boolean;
	isOverdue: boolean;
	isFuture: boolean;
};

export type UtilityBalanceView = {
	id: string;
	utilityType: string;
	totalAmount: number;
	due: number;
	isPaid: boolean;
};

export type LeasePeriodBalance = {
	leaseId: string;
	agreementId: string | null;
	status: string;
	rent: number;
	rentDueDate: number | null;
	startDate: Date;
	endDate: Date | null;
	// Period identity (R2/R3): the IST calendar month of "now" and this
	// period's clamped due date (null when the lease has no charge this month).
	currentPeriodKey: string;
	currentPeriodDueDate: string | null;
	charges: PeriodChargeView[];
	// Outstanding on the current period (0 when no charge exists for it).
	currentRentDue: number;
	// Sum of outstanding for charges whose due date has passed (R14) and that
	// are not pre-start (R3: a lease beginning after its period's due date is
	// not overdue for that period — the shipped overdue.ts skip, generalized).
	overdueRent: number;
	// Every outstanding paise across all charges (arrears + current; future
	// prepaid charges are fully allocated, so they contribute nothing).
	totalRentDue: number;
	// Net rent-scoped bill_credits (negative discounts + positive reversals)
	// and the signed paise of those credits already poured into charges.
	credits: { total: number; allocatedToCharges: number };
	// paid.lifetime is the signed rent ledger (B12 attribution: reversesPaymentId
	// link, referenceNumber fallback; deposits/utility/other excluded).
	// paid.period is the signed allocation stream from payments.
	paid: { lifetime: number; period: number };
	utilities: { totalDue: number; items: UtilityBalanceView[] };
};

function aggregateAmount(value: number | string | null | undefined): number {
	return Number(value ?? 0);
}

export async function getLeasePeriodBalances(
	db: Database,
	leaseIds: string[],
): Promise<LeasePeriodBalance[]> {
	if (leaseIds.length === 0) return [];

	for (const leaseId of leaseIds) {
		await db.execute(ensureAccruedChargesSql({ leaseId }));
	}

	const todayKey = getLocalDateKey(new Date());
	const currentPeriodKey = getLocalPeriodKey(new Date());

	const leaseRows = await db
		.select({
			id: leases.id,
			agreementId: leases.agreementId,
			status: leases.status,
			rent: leases.rent,
			rentDueDate: leases.rentDueDate,
			startDate: leases.startDate,
			endDate: leases.endDate,
		})
		.from(leases)
		.where(inArray(leases.id, leaseIds));

	const chargeRows = await db
		.select({
			leaseId: rentCharges.leaseId,
			periodKey: rentCharges.periodKey,
			dueDate: rentCharges.dueDate,
			amount: rentCharges.amount,
			allocated: sql<
				string | number
			>`coalesce(sum(${rentAllocations.amount}), 0)`,
		})
		.from(rentCharges)
		.leftJoin(rentAllocations, eq(rentAllocations.chargeId, rentCharges.id))
		.where(inArray(rentCharges.leaseId, leaseIds))
		.groupBy(
			rentCharges.id,
			rentCharges.leaseId,
			rentCharges.periodKey,
			rentCharges.dueDate,
			rentCharges.amount,
		)
		.orderBy(rentCharges.periodKey);

	const allocationSplit = await db
		.select({
			leaseId: rentCharges.leaseId,
			paymentAllocated: sql<
				string | number
			>`coalesce(sum(case when ${rentAllocations.paymentId} is not null then ${rentAllocations.amount} else 0 end), 0)`,
			creditAllocated: sql<
				string | number
			>`coalesce(sum(case when ${rentAllocations.creditId} is not null then ${rentAllocations.amount} else 0 end), 0)`,
		})
		.from(rentAllocations)
		.innerJoin(rentCharges, eq(rentAllocations.chargeId, rentCharges.id))
		.where(inArray(rentCharges.leaseId, leaseIds))
		.groupBy(rentCharges.leaseId);

	const creditRows = await db
		.select({
			leaseId: billCredits.leaseId,
			total: sql<string | number>`coalesce(sum(${billCredits.amount}), 0)`,
		})
		.from(billCredits)
		.where(
			and(
				inArray(billCredits.leaseId, leaseIds),
				isNull(billCredits.utilityId),
			),
		)
		.groupBy(billCredits.leaseId);

	// One signed ledger read for all leases; per-lease filtering happens below.
	const ledger = await getSignedLedgerPayments(db, { leaseIds });

	const utilityRows = await db
		.select({
			id: utilities.id,
			leaseId: utilities.leaseId,
			utilityType: utilities.utilityType,
			totalAmount: utilities.totalAmount,
			isPaid: utilities.isPaid,
		})
		.from(utilities)
		.where(inArray(utilities.leaseId, leaseIds));

	const utilityDues = new Map<string, number>();
	for (const utility of utilityRows) {
		utilityDues.set(utility.id, await getAmountDueForUtility(db, utility.id));
	}

	const balances: LeasePeriodBalance[] = [];
	for (const lease of leaseRows) {
		const startDateKey = getLocalDateKey(lease.startDate);

		const charges: PeriodChargeView[] = chargeRows
			.filter((charge) => charge.leaseId === lease.id)
			.map((charge) => {
				const allocated = aggregateAmount(charge.allocated);
				const outstanding = charge.amount - allocated;
				return {
					periodKey: charge.periodKey,
					dueDate: charge.dueDate,
					amount: charge.amount,
					allocated,
					outstanding,
					isPaid: outstanding <= 0,
					isOverdue:
						outstanding > 0 &&
						charge.dueDate < todayKey &&
						charge.dueDate >= startDateKey,
					isFuture: charge.periodKey > currentPeriodKey,
				};
			});

		const split = allocationSplit.find((row) => row.leaseId === lease.id);
		const credits = creditRows.find((row) => row.leaseId === lease.id);
		const lifetimePaid = ledger
			.filter(
				(row) =>
					row.leaseId === lease.id &&
					row.utilityId === null &&
					row.category === PAYMENT_TYPES.RENT,
			)
			.reduce((sum, row) => sum + row.amount, 0);

		const leaseUtilities = utilityRows.filter(
			(row) => row.leaseId === lease.id,
		);
		const utilityItems: UtilityBalanceView[] = [];
		for (const utility of leaseUtilities) {
			utilityItems.push({
				id: utility.id,
				utilityType: utility.utilityType,
				totalAmount: utility.totalAmount,
				due: utilityDues.get(utility.id) ?? 0,
				isPaid: utility.isPaid,
			});
		}

		const totalRentDue = charges.reduce(
			(sum, charge) => sum + charge.outstanding,
			0,
		);
		const currentCharge = charges.find(
			(charge) => charge.periodKey === currentPeriodKey,
		);

		balances.push({
			leaseId: lease.id,
			agreementId: lease.agreementId,
			status: lease.status,
			rent: lease.rent,
			rentDueDate: lease.rentDueDate,
			startDate: lease.startDate,
			endDate: lease.endDate,
			currentPeriodKey,
			currentPeriodDueDate: currentCharge?.dueDate ?? null,
			charges,
			currentRentDue: currentCharge?.outstanding ?? 0,
			overdueRent: charges
				.filter((charge) => charge.isOverdue)
				.reduce((sum, charge) => sum + charge.outstanding, 0),
			totalRentDue,
			credits: {
				total: aggregateAmount(credits?.total),
				allocatedToCharges: aggregateAmount(split?.creditAllocated),
			},
			paid: {
				lifetime: lifetimePaid,
				period: aggregateAmount(split?.paymentAllocated),
			},
			utilities: {
				totalDue: utilityItems.reduce(
					(sum, item) => sum + Math.max(item.due, 0),
					0,
				),
				items: utilityItems,
			},
		});
	}

	// Deterministic order for agreement scopes.
	return balances.sort((a, b) => {
		const byStart = a.startDate.getTime() - b.startDate.getTime();
		return byStart !== 0 ? byStart : a.leaseId.localeCompare(b.leaseId);
	});
}

// ── C08: writer validation bound ──
// The period outstanding plus the R6 prepay cap (at most one future period,
// and only when the lease is guaranteed active for that entire month — the
// same eligibility `ensureNextFuturePeriodChargeSql` enforces, so an accepted
// payment can always be poured in full).
export type LeaseSettlementBound = {
	/** Outstanding on current + past periods (arrears + current due). */
	outstanding: number;
	/** Headroom left under the one-future-period prepay cap (R6). */
	prepayCap: number;
	/** The largest rent payment the period ledger can absorb in full. */
	maxAllowed: number;
	/** Gross accrued charges (H04: bounds cash refunds on settled leases). */
	chargedTotal: number;
};

export async function getLeasePeriodDue(
	db: DbTx | Database,
	leaseId: string,
): Promise<LeaseSettlementBound> {
	const [lease] = await db
		.select({
			rent: leases.rent,
			status: leases.status,
			startDate: leases.startDate,
			endDate: leases.endDate,
		})
		.from(leases)
		.where(eq(leases.id, leaseId))
		.limit(1);

	if (!lease) throw new ORPCError("NOT_FOUND", { message: "Lease not found" });

	const [sums] = await db
		.select({
			charged: sql<string | number>`coalesce(sum(${rentCharges.amount}), 0)`,
		})
		.from(rentCharges)
		.where(eq(rentCharges.leaseId, leaseId));
	const [allocations] = await db
		.select({
			allocated: sql<
				string | number
			>`coalesce(sum(${rentAllocations.amount}), 0)`,
		})
		.from(rentAllocations)
		.innerJoin(rentCharges, eq(rentAllocations.chargeId, rentCharges.id))
		.where(eq(rentCharges.leaseId, leaseId));

	const chargedTotal = aggregateAmount(sums?.charged);
	const outstanding = chargedTotal - aggregateAmount(allocations?.allocated);

	const nextPeriodKey = getNextLocalPeriodKey(new Date());
	const [nextCharge] = await db
		.select({ id: rentCharges.id })
		.from(rentCharges)
		.where(
			and(
				eq(rentCharges.leaseId, leaseId),
				eq(rentCharges.periodKey, nextPeriodKey),
			),
		)
		.limit(1);

	// Prepay eligibility mirrors ensureNextFuturePeriodChargeSql. Once the next
	// charge exists, its remaining paise are already part of `outstanding`.
	let prepayCap = 0;
	if (lease.status === "active") {
		const nextPeriodStart = `${nextPeriodKey}-01`;
		const nextPeriodEnd = new Date(`${nextPeriodStart}T00:00:00Z`);
		nextPeriodEnd.setUTCMonth(nextPeriodEnd.getUTCMonth() + 1);
		const startedBeforeNextPeriod =
			getLocalDateKey(lease.startDate) < nextPeriodStart;
		const activeWholeNextPeriod =
			!lease.endDate ||
			getLocalDateKey(lease.endDate) >= getLocalDateKey(nextPeriodEnd);
		if (startedBeforeNextPeriod && activeWholeNextPeriod && !nextCharge) {
			prepayCap = lease.rent;
		}
	}

	return {
		outstanding,
		prepayCap,
		maxAllowed: outstanding + prepayCap,
		chargedTotal,
	};
}

// Per-lease charge outstanding rows for reminder/overdue consumers: ensures
// the charge set exists (lazy accrual) and returns one row per charge with
// its snapshotted due date and remaining paise.
export type ChargeOutstandingRow = {
	leaseId: string;
	periodKey: string;
	dueDate: string;
	amount: number;
	outstanding: number;
};

export async function getChargeOutstandingRows(
	db: DbTx | Database,
	leaseIds: string[],
): Promise<ChargeOutstandingRow[]> {
	if (leaseIds.length === 0) return [];
	for (const leaseId of leaseIds) {
		await db.execute(ensureAccruedChargesSql({ leaseId }));
	}
	return readChargeOutstandingRows(db, leaseIds);
}

// Pure read: no accrual side effect. The overdue report uses this — the
// nightly reminder job (queryRentCycleRows) owns keeping the charge set
// fresh, so a report must not depend on the wall clock of its caller.
export async function readChargeOutstandingRows(
	db: DbTx | Pick<Database, "select">,
	leaseIds: string[],
): Promise<ChargeOutstandingRow[]> {
	if (leaseIds.length === 0) return [];
	const rows = await db
		.select({
			leaseId: rentCharges.leaseId,
			periodKey: rentCharges.periodKey,
			dueDate: rentCharges.dueDate,
			amount: rentCharges.amount,
			allocated: sql<
				string | number
			>`coalesce(sum(${rentAllocations.amount}), 0)`,
		})
		.from(rentCharges)
		.leftJoin(rentAllocations, eq(rentAllocations.chargeId, rentCharges.id))
		.where(inArray(rentCharges.leaseId, leaseIds))
		.groupBy(
			rentCharges.id,
			rentCharges.leaseId,
			rentCharges.periodKey,
			rentCharges.dueDate,
			rentCharges.amount,
		)
		.orderBy(rentCharges.periodKey);
	return rows.map((row) => ({
		leaseId: row.leaseId,
		periodKey: row.periodKey,
		dueDate: row.dueDate,
		amount: row.amount,
		outstanding: row.amount - aggregateAmount(row.allocated),
	}));
}
