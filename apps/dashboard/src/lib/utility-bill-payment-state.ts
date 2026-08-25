export function getUtilityBillPaymentState({
	amountDue,
	hasPaymentReceipt,
	isPaid,
}: {
	amountDue?: number;
	hasPaymentReceipt: boolean;
	isPaid?: boolean;
}) {
	const paid = amountDue !== undefined ? amountDue <= 0 : Boolean(isPaid);
	return {
		amountLabel: paid ? "Amount paid" : "Total due",
		statusLabel: paid
			? hasPaymentReceipt
				? "Paid · Payment receipt available"
				: "Marked as paid"
			: "Payment pending",
	};
}
