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
import { getAmountDueForRent, getAmountDueForUtility } from "./credit.helpers";
import { getLocalDateKey, getLocalPeriodKey } from "./rent-cycle";
import { ensureAccruedChargesSql } from "./rent-period";
import { getSignedLedgerPayments } from "./signed-ledger";

// ── Period-aware balance read model (C05; rules in docs/Rent-Period-Rules.md) ──
// One owner/tenant-safe server model answering "what does this lease actually
// owe": per-period charges minus allocations (C02 sign convention — an
// allocation is the paise that SETTLES the charge), the lifetime compatibility
// read, credits, paid amounts, and utilities. This does not replace any
// existing reader (C08 cutover); screens migrate in C06/C07.
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
	// The compatibility lifetime read (getAmountDueForRent) — kept until C08.
	lifetimeRentDue: number;
	// totalRentDue − lifetimeRentDue: the accrued history the lifetime model
	// cannot see (0 for leases created in the current period; the visible
	// backdated gap on R13 arrears).
	accruedGap: number;
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

		const lifetimeRentDue = await getAmountDueForRent(db, lease.id);
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
			lifetimeRentDue,
			accruedGap: totalRentDue - lifetimeRentDue,
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
