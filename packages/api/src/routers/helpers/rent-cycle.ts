import {
	SCHEDULED_EMAIL_TYPES,
	type ScheduledEmailType,
} from "@rently/db/constants/scheduled-email-constants";

export const RENT_TIME_ZONE = "Asia/Kolkata";
export const DEFAULT_RENT_DUE_LEAD_DAYS = 3;
export const DEFAULT_OVERDUE_GRACE_DAYS = 2;

type LocalDateParts = { year: number; month: number; day: number };

export type RentCycleRow = {
	leaseId: string;
	ownerId: string;
	ownerName: string;
	tenantName: string;
	tenantEmail: string;
	propertyName: string;
	unitNumber: string;
	rent: number;
	startDate: Date;
	endDate: Date | null;
	rentDueDate: number | null;
	leaseStatus: "active" | "expired" | "terminated";
	paidAmount: number;
	leaseExpiryAlert: boolean;
	rentDueReminder: boolean;
	overdueAlert: boolean;
	rentDueLeadDays: number;
	overdueGraceDays: number;
	suppressedPeriodKeys: string[];
};

export type RentCycleItem = {
	type: ScheduledEmailType;
	periodKey: string;
	thresholdDays: number;
	dueDate: string | null;
	endDate: string | null;
	row: RentCycleRow;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function getLocalDateParts(value: Date): LocalDateParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: RENT_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(value);

	const get = (type: "year" | "month" | "day") => {
		const part = parts.find((item) => item.type === type)?.value;
		if (!part) throw new Error(`Missing local date part: ${type}`);
		return Number(part);
	};

	return { year: get("year"), month: get("month"), day: get("day") };
}

export function getLocalDateKey(value: Date): string {
	const { year, month, day } = getLocalDateParts(value);
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function getLocalPeriodKey(value: Date): string {
	const { year, month } = getLocalDateParts(value);
	return `${year}-${pad(month)}`;
}

export function getNextLocalPeriodKey(value: Date): string {
	const { year, month } = getLocalDateParts(value);
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	return `${nextYear}-${pad(nextMonth)}`;
}

export function getAdjacentPeriodKey(
	periodKey: string,
	offset: number,
): string {
	const [yearText, monthText] = periodKey.split("-");
	const date = new Date(
		Date.UTC(Number(yearText), Number(monthText) - 1 + offset, 1),
	);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getDueDateKey(periodKey: string, dueDay: number): string {
	const [yearText, monthText] = periodKey.split("-");
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Math.min(dueDay, daysInMonth(year, month));
	return `${yearText}-${monthText}-${pad(day)}`;
}

export function differenceInCalendarDays(
	fromDateKey: string,
	toDateKey: string,
): number {
	const from = Date.parse(`${fromDateKey}T00:00:00Z`);
	const to = Date.parse(`${toDateKey}T00:00:00Z`);
	return Math.round((to - from) / 86_400_000);
}

export function computeRentCycleItem(
	row: RentCycleRow,
	localToday: string,
): RentCycleItem[] {
	if (row.leaseStatus !== "active") return [];

	const items: RentCycleItem[] = [];
	const localStart = getLocalDateKey(row.startDate);
	const endDate = row.endDate ? getLocalDateKey(row.endDate) : null;
	if (localToday < localStart || (endDate !== null && localToday > endDate)) {
		return items;
	}

	if (endDate) {
		const daysUntilExpiry = differenceInCalendarDays(localToday, endDate);
		if ([30, 7, 1].includes(daysUntilExpiry)) {
			items.push({
				type: SCHEDULED_EMAIL_TYPES.LEASE_EXPIRY,
				periodKey: endDate,
				thresholdDays: daysUntilExpiry,
				dueDate: null,
				endDate,
				row,
			});
		}
	}

	if (
		row.rentDueDate === null ||
		row.rentDueDate < 1 ||
		row.rentDueDate > 31 ||
		row.paidAmount >= row.rent
	)
		return items;

	const currentPeriodKey = localToday.slice(0, 7);
	const duePeriodKey = [
		currentPeriodKey,
		getAdjacentPeriodKey(currentPeriodKey, 1),
	].find((candidatePeriodKey) => {
		const candidateDueDate = getDueDateKey(
			candidatePeriodKey,
			row.rentDueDate as number,
		);
		return (
			differenceInCalendarDays(localToday, candidateDueDate) ===
			row.rentDueLeadDays
		);
	});

	if (duePeriodKey) {
		const dueDate = getDueDateKey(duePeriodKey, row.rentDueDate);
		items.push({
			type: SCHEDULED_EMAIL_TYPES.RENT_DUE,
			periodKey: duePeriodKey,
			thresholdDays: row.rentDueLeadDays,
			dueDate,
			endDate,
			row,
		});
	}

	const currentDueDate = getDueDateKey(currentPeriodKey, row.rentDueDate);
	const daysUntilCurrentDue = differenceInCalendarDays(
		localToday,
		currentDueDate,
	);
	if (daysUntilCurrentDue === -row.overdueGraceDays) {
		items.push({
			type: SCHEDULED_EMAIL_TYPES.OVERDUE,
			periodKey: currentPeriodKey,
			thresholdDays: row.overdueGraceDays,
			dueDate: currentDueDate,
			endDate,
			row,
		});
	}

	return items;
}
