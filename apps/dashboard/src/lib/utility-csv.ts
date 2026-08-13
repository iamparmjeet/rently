import {
	formatDateOnly,
	getCalendarDateParts,
	INDIA_TIME_ZONE,
} from "@rently/ui/lib/date";
import type { UtilityListItem } from "@rently/validators";

const CSV_BOM = "\uFEFF";
const CSV_LINE_ENDING = "\r\n";

export const UTILITY_EXPORT_HEADERS = [
	"Utility ID",
	"Reading Date",
	"Utility Type",
	"Entry Status",
	"Tenant Name",
	"Property",
	"Unit",
	"Previous Reading",
	"Current Reading",
	"Units Used",
	"Rate per Unit (INR)",
	"Fixed Charge (INR)",
	"Total Amount (INR)",
	"Description",
] as const;

function neutralizeSpreadsheetFormula(value: string): string {
	return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

function escapeCsvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function escapeUserText(value: string): string {
	return escapeCsvCell(neutralizeSpreadsheetFormula(value));
}

function formatPaise(paise: number | null): string {
	if (paise === null) return "";
	if (!Number.isSafeInteger(paise)) {
		throw new RangeError("Utility amount must be a safe integer.");
	}

	const sign = paise < 0 ? "-" : "";
	const absolutePaise = Math.abs(paise);
	return `${sign}${Math.floor(absolutePaise / 100)}.${String(
		absolutePaise % 100,
	).padStart(2, "0")}`;
}

function formatRatePerUnit(rate: number | null): string {
	if (rate === null) return "";
	if (!Number.isFinite(rate)) {
		throw new RangeError("Utility rate must be finite.");
	}

	// New records store rates in paise. Legacy rows may retain a fractional
	// rupee value, which cannot be represented as an integer paise amount.
	return Number.isSafeInteger(rate) ? formatPaise(rate) : rate.toFixed(2);
}

function formatReadingDate(date: Date): string {
	return formatDateOnly(getCalendarDateParts(date, INDIA_TIME_ZONE));
}

function utilityExportRowToCsv(utility: UtilityListItem): string {
	return [
		escapeCsvCell(utility.id),
		escapeCsvCell(formatReadingDate(utility.currentReadingDate)),
		escapeCsvCell(utility.utilityType),
		escapeCsvCell(utility.isPaid ? "Paid" : "Unpaid"),
		escapeUserText(utility.tenantName ?? ""),
		escapeUserText(utility.propertyName),
		escapeUserText(utility.unitNumber),
		utility.previousReading?.toString() ?? "",
		utility.currentReading.toString(),
		utility.unitsUsed?.toString() ?? "",
		formatRatePerUnit(utility.ratePerUnit),
		formatPaise(utility.fixedCharge),
		formatPaise(utility.totalAmount),
		escapeUserText(utility.description ?? ""),
	].join(",");
}

export function utilityExportRowsToCsv(rows: UtilityListItem[]): string {
	return `${CSV_BOM}${[UTILITY_EXPORT_HEADERS.join(","), ...rows.map(utilityExportRowToCsv)].join(CSV_LINE_ENDING)}${CSV_LINE_ENDING}`;
}

export function formatUtilityExportFilename(): string {
	return "keyhq-utilities.csv";
}
