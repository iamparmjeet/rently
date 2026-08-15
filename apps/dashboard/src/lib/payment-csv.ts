import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { generateReceiptNumber } from "@rently/db/utils/receipt";
import {
	type DateRange,
	formatDateOnly,
	getCalendarDateParts,
	INDIA_TIME_ZONE,
} from "@rently/ui/lib/date";
import type { PaymentExportRow } from "@rently/validators";

const CSV_BOM = "\uFEFF";
const CSV_LINE_ENDING = "\r\n";

export const PAYMENT_EXPORT_HEADERS = [
	"Payment ID",
	"Payment Date",
	"Payment Type",
	"Entry Status",
	"Tenant Name",
	"Property",
	"Unit",
	"Receipt Number",
	"Amount (INR)",
	"Payment Method",
	"Reference Number",
	"Description",
] as const;

const PAYMENT_TYPE_LABELS: Record<string, string> = {
	rent: "Rent",
	utility: "Utility",
	deposit: "Deposit",
	other: "Other",
	reversal: "Reversal",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
	upi: "UPI",
	bank_transfer: "Bank Transfer / NEFT",
	cash: "Cash",
	cheque: "Cheque",
	online: "Online Banking",
};

/**
 * Prevents spreadsheet applications from evaluating user-controlled
 * text as a formula.
 */
function neutralizeSpreadsheetFormula(value: string): string {
	if (/^[=+\-@]/.test(value.trimStart())) {
		return `'${value}`;
	}

	return value;
}

/**
 * Applies RFC 4180 CSV escaping.
 */
function escapeCsvCell(value: string): string {
	if (!/[",\r\n]/.test(value)) {
		return value;
	}

	return `"${value.replaceAll('"', '""')}"`;
}

/**
 * Marks a value as user-controlled before applying CSV escaping.
 */
function escapeUserText(value: string): string {
	return escapeCsvCell(neutralizeSpreadsheetFormula(value));
}

/**
 * Converts integer paise to an exact decimal rupee value.
 *
 * Floating-point division and toFixed() are intentionally avoided.
 */
export function formatPaymentExportAmount(paise: number): string {
	if (!Number.isSafeInteger(paise)) {
		throw new RangeError("Payment amount must be a safe integer.");
	}

	const sign = paise < 0 ? "-" : "";
	const absolutePaise = Math.abs(paise);
	const rupees = Math.floor(absolutePaise / 100);
	const remainingPaise = absolutePaise % 100;

	return `${sign}${rupees}.${String(remainingPaise).padStart(2, "0")}`;
}

function formatPaymentDate(date: Date): string {
	return formatDateOnly(getCalendarDateParts(date, INDIA_TIME_ZONE));
}

function getPaymentTypeLabel(type: string): string {
	return PAYMENT_TYPE_LABELS[type] ?? type;
}

function getPaymentMethodLabel(method: string | null): string {
	if (!method) return "";

	return PAYMENT_METHOD_LABELS[method] ?? method;
}

function paymentExportRowToCsv(row: PaymentExportRow): string {
	const isReversal = row.type === PAYMENT_TYPES.REVERSAL;

	const cells = [
		escapeCsvCell(row.id),
		escapeCsvCell(formatPaymentDate(row.paymentDate)),
		escapeCsvCell(getPaymentTypeLabel(row.type)),
		escapeCsvCell(isReversal ? "Reversal" : "Recorded"),
		escapeUserText(row.tenantName),
		escapeUserText(row.propertyName),
		escapeUserText(row.unitNumber),
		escapeCsvCell(isReversal ? "" : generateReceiptNumber(row.id)),

		// This value is generated from a safe integer. Do not run it
		// through formula neutralization because negative amounts
		// must remain numeric spreadsheet cells.
		formatPaymentExportAmount(row.amount),

		escapeCsvCell(getPaymentMethodLabel(row.paymentMethods)),
		escapeUserText(row.referenceNumber ?? ""),
		escapeUserText(row.description ?? ""),
	];

	return cells.join(",");
}

export function paymentExportRowsToCsv(rows: PaymentExportRow[]): string {
	const header = PAYMENT_EXPORT_HEADERS.join(",");

	const body = rows.map(paymentExportRowToCsv);

	return `${CSV_BOM}${[header, ...body].join(
		CSV_LINE_ENDING,
	)}${CSV_LINE_ENDING}`;
}

export function formatOwnerPaymentExportFilename(range: DateRange): string {
	return `keyhq-payments-${range.startDate}-to-${range.endDate}.csv`;
}

export function downloadCsv(csv: string, filename: string): void {
	const blob = new Blob([csv], {
		type: "text/csv;charset=utf-8",
	});

	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	try {
		anchor.href = objectUrl;
		anchor.download = filename;
		anchor.style.display = "none";

		document.body.appendChild(anchor);
		anchor.click();
	} finally {
		anchor.remove();
		URL.revokeObjectURL(objectUrl);
	}
}

function sanitizeFilenameSegment(value: string): string {
	const sanitized = value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{ASCII}]/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/g, "");

	return sanitized || "tenant";
}

export function formatTenantPaymentExportFilename(tenantName: string): string {
	return `keyhq-${sanitizeFilenameSegment(tenantName)}-payment-history.csv`;
}
