import { getIdTimestamp } from "@rently/db/utils/id";

export function getCreditNoteNumber(id: string) {
	return `KQ-CN-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;
}

export function formatCreditNoteDate(value: Date) {
	return new Intl.DateTimeFormat("en-IN", {
		day: "2-digit",
		month: "long",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	}).format(new Date(value));
}

export function getCreditNoteTimestamp(id: string): Date | null {
	try {
		return getIdTimestamp(id);
	} catch {
		return null;
	}
}
