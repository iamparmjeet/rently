export type UtilityBillChargeLine = {
	label: string;
	detail: string | null;
	amount: number;
};

type UtilityBillChargeInput = {
	utilityType: string;
	unitsUsed: number | null;
	ratePerUnit: number | null;
	fixedCharge: number | null;
	totalAmount: number;
	description: string | null;
};

export function getUtilityBillNumber(id: string) {
	return `KQ-UTL-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;
}

export function getUtilityBillChargeLines({
	description,
	fixedCharge,
	ratePerUnit,
	totalAmount,
	unitsUsed,
	utilityType,
}: UtilityBillChargeInput): UtilityBillChargeLine[] {
	if (utilityType !== "electricity") {
		return [
			{
				label: utilityType,
				detail: description?.trim() || "Flat utility charge",
				amount: totalAmount,
			},
		];
	}

	const units = unitsUsed ?? 0;
	const rate = ratePerUnit ?? 0;
	const fixed = fixedCharge ?? 0;
	const usageAmount = Math.round(units * rate);
	const reconciles = usageAmount + fixed === totalAmount;

	// Legacy imports and old demo rows may contain rupee values in a paise
	// column. Never print a formula that does not add up to the stored total.
	if (!reconciles) {
		return [
			{
				label: "Electricity",
				detail: `${units.toFixed(2)} units recorded`,
				amount: totalAmount,
			},
		];
	}

	const lines: UtilityBillChargeLine[] = [
		{
			label: "Electricity usage",
			detail: `${units.toFixed(2)} units`,
			amount: usageAmount,
		},
	];

	if (fixed > 0) {
		lines.push({ label: "Fixed charge", detail: null, amount: fixed });
	}

	return lines;
}
