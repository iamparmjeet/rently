import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";

type SettlementPayment = {
	readonly leaseId: string;
	readonly type: string;
	readonly utilityId: string | null;
};

type SettlementCredit = {
	readonly amount: number;
	readonly leaseId: string;
	readonly type: string;
	readonly utilityId: string | null;
};

export function getSettledCredits<TCredit extends SettlementCredit>(
	credits: readonly TCredit[],
	payments: readonly SettlementPayment[],
): TCredit[] {
	const paidUtilityIds = new Set(
		payments
			.filter(
				(payment) =>
					payment.utilityId != null && payment.type !== PAYMENT_TYPES.REVERSAL,
			)
			.map((payment) => payment.utilityId),
	);
	const paidRentLeaseIds = new Set(
		payments
			.filter(
				(payment) =>
					payment.utilityId == null && payment.type === PAYMENT_TYPES.RENT,
			)
			.map((payment) => payment.leaseId),
	);

	return credits.filter((credit) =>
		credit.utilityId
			? paidUtilityIds.has(credit.utilityId)
			: paidRentLeaseIds.has(credit.leaseId),
	);
}

export function getNetSettledDiscountTotal<TCredit extends SettlementCredit>(
	credits: readonly TCredit[],
	payments: readonly SettlementPayment[],
): number {
	return getSettledCredits(credits, payments)
		.filter((credit) => credit.type === CREDIT_TYPES.DISCOUNT)
		.reduce((total, credit) => total + credit.amount, 0);
}

export function getNetDiscountDisplayAmount(netDiscountTotal: number): number {
	return netDiscountTotal === 0 ? 0 : -netDiscountTotal;
}
