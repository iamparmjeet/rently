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

const rupeesOptionalPaiseFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

export const formatRupeesOptionalPaise = (paise: number): string =>
	rupeesOptionalPaiseFormatter.format(paise / 100);

// ************* Receipt Generated **************
const SMALL_NUMBER_WORDS = [
	"Zero",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
	"Eleven",
	"Twelve",
	"Thirteen",
	"Fourteen",
	"Fifteen",
	"Sixteen",
	"Seventeen",
	"Eighteen",
	"Nineteen",
];

const TENS_WORDS = [
	"",
	"",
	"Twenty",
	"Thirty",
	"Forty",
	"Fifty",
	"Sixty",
	"Seventy",
	"Eighty",
	"Ninety",
];

function numberToIndianWords(value: number): string {
	if (value < 20) return SMALL_NUMBER_WORDS[value] ?? "";
	if (value < 100) {
		const tens = TENS_WORDS[Math.floor(value / 10)] ?? "";
		const ones = value % 10;
		return ones === 0 ? tens : `${tens} ${numberToIndianWords(ones)}`;
	}
	if (value < 1_000) {
		const hundreds = `${numberToIndianWords(Math.floor(value / 100))} Hundred`;
		const remainder = value % 100;
		return remainder === 0
			? hundreds
			: `${hundreds} ${numberToIndianWords(remainder)}`;
	}

	const scales: Array<[number, string]> = [
		[10_000_000, "Crore"],
		[100_000, "Lakh"],
		[1_000, "Thousand"],
	];

	for (const [divisor, label] of scales) {
		if (value >= divisor) {
			const leading = `${numberToIndianWords(Math.floor(value / divisor))} ${label}`;
			const remainder = value % divisor;
			return remainder === 0
				? leading
				: `${leading} ${numberToIndianWords(remainder)}`;
		}
	}

	return "";
}

/**
 * Converts an integer paise amount to formal Indian receipt wording.
 */
export function rupeesToWords(paise: number): string {
	if (!Number.isSafeInteger(paise) || paise < 0) {
		throw new RangeError("Paise must be a non-negative safe integer.");
	}

	const rupees = Math.floor(paise / 100);
	const remainingPaise = paise % 100;
	const rupeeLabel = rupees === 1 ? "Rupee" : "Rupees";

	if (remainingPaise === 0) {
		return `${numberToIndianWords(rupees)} ${rupeeLabel} Only`;
	}

	const paiseLabel = remainingPaise === 1 ? "Paisa" : "Paise";
	return `${numberToIndianWords(rupees)} ${rupeeLabel} and ${numberToIndianWords(remainingPaise)} ${paiseLabel} Only`;
}
