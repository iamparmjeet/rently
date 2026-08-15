export function getUtilityBillPaymentState({
	isPaid,
	hasPaymentReceipt,
}: {
	isPaid: boolean;
	hasPaymentReceipt: boolean;
}) {
	return {
		amountLabel: isPaid ? "Amount paid" : "Total due",
		statusLabel: isPaid
			? hasPaymentReceipt
				? "Paid · Payment receipt available"
				: "Marked as paid"
			: "Payment pending",
	};
}
