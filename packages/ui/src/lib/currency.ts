const rupeesFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const toRupees = (paise: number) => paise / 100;
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const formatRupees = (paise: number): string =>
	rupeesFormatter.format(paise / 100); // 100 -> ₹1.00

export function formatFormRupees(amount: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
	}).format(amount);
}

export const paiseToFormValue = (paisa: number) => paisa / 100; // 100 -> 1Rs
