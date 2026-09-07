import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	ownerProfiles,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getSignedLedgerPayments } from "./signed-ledger";

// Single-bill ownership read shared by the utility procedures and the H01
// statement procedures. Lives here (not in rent/utility.ts) because every
// export of a router module must be a Procedure.
export async function getOwnedUtility(
	db: Database,
	utilityId: string,
	userId: string,
) {
	const [row] = await db
		.select({
			id: utilities.id,
			leaseId: utilities.leaseId,
			batchId: utilities.batchId,
			utilityType: utilities.utilityType,
			currentReadingDate: utilities.currentReadingDate,
			previousReadingDate: utilities.previousReadingDate,
			ratePerUnit: utilities.ratePerUnit,
			unitsUsed: utilities.unitsUsed,
			previousReading: utilities.previousReading,
			currentReading: utilities.currentReading,
			fixedCharge: utilities.fixedCharge,
			totalAmount: utilities.totalAmount,
			description: utilities.description,
			isPaid: utilities.isPaid,
			createdAt: utilities.createdAt,
			updatedAt: utilities.updatedAt,
			ownerId: properties.ownerId,
			unitNumber: units.unitNumber,
			propertyName: properties.name,
			propertyAddress: properties.address,
			tenantName: user.name,
			companyName: ownerProfiles.companyName,
			ownerAddress: ownerProfiles.address,
			gstNumber: ownerProfiles.gstNumber,
		})
		.from(utilities)
		.innerJoin(leases, eq(utilities.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(leases.tenantId, user.id))
		.leftJoin(
			ownerProfiles,
			and(
				eq(ownerProfiles.userId, properties.ownerId),
				isNull(ownerProfiles.deletedAt),
			),
		)
		.where(
			and(
				eq(utilities.id, utilityId),
				isNull(units.deletedAt),
				isNull(properties.deletedAt),
			),
		)
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: "Utility entry not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not own this utility",
		});
	}

	const ledger = await getSignedLedgerPayments(db, {
		utilityIds: [utilityId],
	});
	const receiptPayment = ledger
		.filter(
			(payment) =>
				payment.category === PAYMENT_TYPES.UTILITY &&
				!payment.isReversal &&
				!payment.isReversed,
		)
		.sort(
			(a, b) =>
				b.createdAt.getTime() - a.createdAt.getTime() ||
				b.id.localeCompare(a.id),
		)
		.at(0);

	const credits = await db
		.select({
			amount: billCredits.amount,
			reason: billCredits.reason,
			creditNoteNo: billCredits.creditNoteNo,
			type: billCredits.type,
			appliedAs: billCredits.appliedAs,
		})
		.from(billCredits)
		.where(eq(billCredits.utilityId, utilityId))
		.orderBy(billCredits.createdAt);

	const creditsSum = credits.reduce((s, c) => s + c.amount, 0);
	const paidSum = ledger
		.filter((payment) => payment.category === PAYMENT_TYPES.UTILITY)
		.reduce((sum, payment) => sum + payment.amount, 0);
	const amountDue = row.totalAmount + creditsSum - paidSum;

	return {
		...row,
		credits,
		amountDue,
		receiptPaymentId: receiptPayment?.id ?? null,
	};
}
