type CollectionHealthPayment = {
	amount: number;
	paymentDate: Date | string;
};

type CollectionHealthScope = "month" | "all-time";

function occursInMonth(date: Date | string, referenceDate: Date): boolean {
	const entryDate = new Date(date);

	return (
		entryDate.getFullYear() === referenceDate.getFullYear() &&
		entryDate.getMonth() === referenceDate.getMonth()
	);
}

export function getCollectionHealth({
	payments,
	referenceDate = new Date(),
	scope = "month",
}: {
	payments: CollectionHealthPayment[];
	referenceDate?: Date;
	scope?: CollectionHealthScope;
}) {
	const includedPayments =
		scope === "all-time"
			? payments
			: payments.filter((payment) =>
					occursInMonth(payment.paymentDate, referenceDate),
				);

	const paymentAmount = includedPayments.reduce(
		(total, payment) => total + payment.amount,
		0,
	);

	return {
		amount: paymentAmount,
		transactionCount: includedPayments.length,
	};
}
