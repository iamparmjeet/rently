export function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function formatMoney(paise: number | null | undefined): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format((paise ?? 0) / 100);
}
