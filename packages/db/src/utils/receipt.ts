import { getIdTimestamp } from "./id";

const UUID_V7_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatReceiptDate(date: Date): string {
	const parts = new Intl.DateTimeFormat("en-IN", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value;

	return `${part("year")}${part("month")}${part("day")}`;
}

/**
 * Builds a stable, collision-free receipt number from a payment UUIDv7.
 *
 * The date segment is the payment record's UUIDv7 creation date in
 * Asia/Kolkata. The full UUID suffix preserves uniqueness without a
 * database sequence or receipt-number column.
 */

export function generateReceiptNumber(paymentId: string): string {
	if (!UUID_V7_PATTERN.test(paymentId)) {
		throw new RangeError("Payment ID must be a valid UUIDv7.");
	}

	const timestamp = getIdTimestamp(paymentId);
	if (Number.isNaN(timestamp.getTime())) {
		throw new RangeError("Payment ID contains an invalid UUIDv7 timestamp.");
	}

	return `KQ-RCPT-${formatReceiptDate(timestamp)}-${paymentId.replaceAll("-", "").toUpperCase()}`;
}
