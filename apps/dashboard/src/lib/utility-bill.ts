export type UtilityBillChargeLine = {
	label: string;
	detail: string | null;
	amount: number;
};

export type BillCreditInput = {
	amount: number;
	reason: string;
	creditNoteNo: string;
	type?: string;
};

type UtilityBillChargeInput = {
	utilityType: string;
	unitsUsed: number | null;
	ratePerUnit: number | null;
	fixedCharge: number | null;
	totalAmount: number;
	description: string | null;
	credits?: BillCreditInput[] | null;
};

export function getUtilityBillNumber(id: string) {
	return `KQ-UTL-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;
}

export function getUtilityBillChargeLines({
	credits,
	description,
	fixedCharge,
	ratePerUnit,
	totalAmount,
	unitsUsed,
	utilityType,
}: UtilityBillChargeInput): UtilityBillChargeLine[] {
	let base: UtilityBillChargeLine[];
	if (utilityType !== "electricity") {
		base = [
			{
				label: utilityType,
				detail: description?.trim() || "Flat utility charge",
				amount: totalAmount,
			},
		];
	} else {
		const units = unitsUsed ?? 0;
		const rate = ratePerUnit ?? 0;
		const fixed = fixedCharge ?? 0;
		const usageAmount = Math.round(units * rate);
		const reconciles = usageAmount + fixed === totalAmount;

		// Legacy imports and old demo rows may contain rupee values in a paise
		// column. Never print a formula that does not add up to the stored total.
		if (!reconciles) {
			base = [
				{
					label: "Electricity",
					detail: `${units.toFixed(2)} units recorded`,
					amount: totalAmount,
				},
			];
		} else {
			base = [
				{
					label: "Electricity usage",
					detail: `${units.toFixed(2)} units`,
					amount: usageAmount,
				},
			];
			if (fixed > 0) {
				base.push({ label: "Fixed charge", detail: null, amount: fixed });
			}
		}
	}

	if (!credits?.length) return base;

	for (const c of credits) {
		const reason = c.reason?.trim() || "Discount";
		const isCreditNote = c.type === "credit_note";
		const isWriteOff = c.type === "write_off";
		if (isCreditNote) {
			base.push({
				label: `Credit Note ${c.creditNoteNo}`,
				detail: reason,
				amount: c.amount,
			});
		} else {
			const prefix = isWriteOff ? "Write-off" : "Discount";
			base.push({
				label: `${prefix} — ${reason}`,
				detail: `Credit Note ${c.creditNoteNo}`,
				amount: c.amount,
			});
		}
	}

	return base;
}
