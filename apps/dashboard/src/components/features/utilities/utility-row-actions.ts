export function isUtilityRowActionTarget(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest("[data-utility-row-action]") !== null
	);
}

export function getUtilityDocumentAction({
	utilityId,
	receiptPaymentId,
}: {
	utilityId: string;
	receiptPaymentId: string | null;
}) {
	if (receiptPaymentId) {
		return {
			href: `/receipts/${receiptPaymentId}?print=true`,
			label: "Download receipt",
			title: "Open a printable payment receipt",
		};
	}

	return {
		href: `/utilities/${utilityId}?print=true`,
		label: "Download bill",
		title: "Open a printable utility bill",
	};
}
