import type { Database } from "@rently/db";
import { db as defaultDb } from "@rently/db";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import {
	SCHEDULED_EMAIL_DELIVERY_STATUSES,
	SCHEDULED_EMAIL_TYPES,
} from "@rently/db/constants/scheduled-email-constants";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	notificationPreferences,
	properties,
	rentReminderSuppressions,
	scheduledEmailDeliveries,
	units,
} from "@rently/db/schema/schema";
import {
	sendLeaseExpiryReminderEmail,
	sendOverdueRentReminderEmail,
	sendRentDueReminderEmail,
} from "@rently/email";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
	computeRentCycleItem,
	DEFAULT_OVERDUE_GRACE_DAYS,
	DEFAULT_RENT_DUE_LEAD_DAYS,
	getAdjacentPeriodKey,
	getLocalDateKey,
	getLocalPeriodKey,
	type RentCycleItem,
	type RentCycleRow,
} from "./routers/helpers/rent-cycle";
import { getSignedLedgerPayments } from "./routers/helpers/signed-ledger";

const tenantUser = alias(user, "scheduled_tenant");

export type ScheduledReminderJobResult = {
	evaluated: number;
	claimed: number;
	sent: number;
	failed: number;
	preferenceSkipped: number;
	suppressionSkipped: number;
	duplicateSkipped: number;
};

export async function queryRentCycleRows(
	database: Database,
	now: Date,
	ownerId?: string,
): Promise<RentCycleRow[]> {
	const rows = await database
		.select({
			leaseId: leases.id,
			ownerId: properties.ownerId,
			ownerName: user.name,
			tenantName: tenantUser.name,
			tenantEmail: tenantUser.email,
			propertyName: properties.name,
			unitNumber: units.unitNumber,
			rent: leases.rent,
			startDate: leases.startDate,
			endDate: leases.endDate,
			rentDueDate: leases.rentDueDate,
			leaseStatus: leases.status,
			leaseExpiryAlert: notificationPreferences.leaseExpiryAlert,
			rentDueReminder: notificationPreferences.rentDueReminder,
			overdueAlert: notificationPreferences.overdueAlert,
			rentDueLeadDays: notificationPreferences.rentDueLeadDays,
			overdueGraceDays: notificationPreferences.overdueGraceDays,
		})
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(properties.ownerId, user.id))
		.innerJoin(tenantUser, eq(leases.tenantId, tenantUser.id))
		.leftJoin(
			notificationPreferences,
			eq(notificationPreferences.ownerId, properties.ownerId),
		)
		.where(
			and(
				eq(leases.status, "active"),
				eq(user.accountMode, ACCOUNT_MODES.STANDARD),
				eq(user.workspaceMode, WORKSPACE_MODES.LIVE),
				isNull(properties.deletedAt),
				isNull(units.deletedAt),
				ownerId ? eq(properties.ownerId, ownerId) : undefined,
			),
		)
		.orderBy(asc(properties.ownerId), asc(leases.id));

	if (rows.length === 0) return [];

	const periodKey = getLocalPeriodKey(now);
	const suppressionPeriodKeys = [periodKey, getAdjacentPeriodKey(periodKey, 1)];
	const leaseIds = rows.map((row) => row.leaseId);
	const paymentRows = await getSignedLedgerPayments(database, { leaseIds });

	const paidByLease = new Map<string, number>();
	for (const payment of paymentRows) {
		if (
			payment.utilityId !== null ||
			payment.category !== PAYMENT_TYPES.RENT ||
			getLocalPeriodKey(payment.paymentDate) !== periodKey
		)
			continue;
		paidByLease.set(
			payment.leaseId,
			(paidByLease.get(payment.leaseId) ?? 0) + payment.amount,
		);
	}

	// Rent/general credits (utilityId null) net against rent — negative discounts + positive reversals
	const creditRows = await database
		.select({
			leaseId: billCredits.leaseId,
			amount: billCredits.amount,
		})
		.from(billCredits)
		.where(
			and(
				inArray(billCredits.leaseId, leaseIds),
				isNull(billCredits.utilityId),
			),
		);
	const creditByLease = new Map<string, number>();
	for (const row of creditRows) {
		creditByLease.set(
			row.leaseId,
			(creditByLease.get(row.leaseId) ?? 0) + row.amount,
		);
	}

	const suppressions = await database
		.select({
			leaseId: rentReminderSuppressions.leaseId,
			periodKey: rentReminderSuppressions.periodKey,
		})
		.from(rentReminderSuppressions)
		.where(
			and(
				inArray(rentReminderSuppressions.periodKey, suppressionPeriodKeys),
				inArray(rentReminderSuppressions.leaseId, leaseIds),
			),
		);
	return rows.map((row) => ({
		...row,
		paidAmount: paidByLease.get(row.leaseId) ?? 0,
		creditAmount: creditByLease.get(row.leaseId) ?? 0,
		leaseExpiryAlert: row.leaseExpiryAlert ?? true,
		rentDueReminder: row.rentDueReminder ?? true,
		overdueAlert: row.overdueAlert ?? true,
		rentDueLeadDays: row.rentDueLeadDays ?? DEFAULT_RENT_DUE_LEAD_DAYS,
		overdueGraceDays: row.overdueGraceDays ?? DEFAULT_OVERDUE_GRACE_DAYS,
		suppressedPeriodKeys: suppressions
			.filter((suppression) => suppression.leaseId === row.leaseId)
			.map((suppression) => suppression.periodKey),
	}));
}

function preferenceEnabled(item: RentCycleItem): boolean {
	switch (item.type) {
		case SCHEDULED_EMAIL_TYPES.LEASE_EXPIRY:
			return item.row.leaseExpiryAlert;
		case SCHEDULED_EMAIL_TYPES.RENT_DUE:
			return item.row.rentDueReminder;
		case SCHEDULED_EMAIL_TYPES.OVERDUE:
			return item.row.overdueAlert;
	}
}

async function sendReminder(item: RentCycleItem): Promise<void> {
	const { row } = item;
	if (item.type === SCHEDULED_EMAIL_TYPES.LEASE_EXPIRY) {
		if (!item.endDate) throw new Error("LEASE_EXPIRY_DATE_MISSING");
		await sendLeaseExpiryReminderEmail({
			to: row.tenantEmail,
			tenantName: row.tenantName,
			ownerName: row.ownerName,
			propertyName: row.propertyName,
			unitNumber: row.unitNumber,
			rent: row.rent,
			endDate: item.endDate,
			daysUntilExpiry: item.thresholdDays,
		});
		return;
	}

	if (!item.dueDate) throw new Error("RENT_DUE_DATE_MISSING");
	const common = {
		to: row.tenantEmail,
		tenantName: row.tenantName,
		ownerName: row.ownerName,
		propertyName: row.propertyName,
		unitNumber: row.unitNumber,
		rent: row.rent,
		dueDate: item.dueDate,
	};

	if (item.type === SCHEDULED_EMAIL_TYPES.RENT_DUE) {
		await sendRentDueReminderEmail({
			...common,
			leadDays: item.thresholdDays,
		});
		return;
	}

	await sendOverdueRentReminderEmail({
		...common,
		graceDays: item.thresholdDays,
	});
}

async function claimDelivery(
	database: Database,
	item: RentCycleItem,
): Promise<{ state: "claimed" | "duplicate"; id?: string }> {
	let claim: (typeof scheduledEmailDeliveries)["$inferSelect"] | undefined;
	try {
		[claim] = await database
			.insert(scheduledEmailDeliveries)
			.values({
				ownerId: item.row.ownerId,
				leaseId: item.row.leaseId,
				type: item.type,
				periodKey: item.periodKey,
				thresholdDays: item.thresholdDays,
				status: SCHEDULED_EMAIL_DELIVERY_STATUSES.CLAIMED,
			})
			.onConflictDoNothing({
				target: [
					scheduledEmailDeliveries.ownerId,
					scheduledEmailDeliveries.leaseId,
					scheduledEmailDeliveries.type,
					scheduledEmailDeliveries.periodKey,
					scheduledEmailDeliveries.thresholdDays,
				],
			})
			.returning();
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "23503"
		) {
			return { state: "duplicate" };
		}
		throw error;
	}

	if (claim) return { state: "claimed", id: claim.id };

	// Duplicate — check if prior FAILED and older than 1h allows retry (H-06)
	const [existing] = await database
		.select({
			id: scheduledEmailDeliveries.id,
			status: scheduledEmailDeliveries.status,
			updatedAt: scheduledEmailDeliveries.updatedAt,
		})
		.from(scheduledEmailDeliveries)
		.where(
			and(
				eq(scheduledEmailDeliveries.ownerId, item.row.ownerId),
				eq(scheduledEmailDeliveries.leaseId, item.row.leaseId),
				eq(scheduledEmailDeliveries.type, item.type),
				eq(scheduledEmailDeliveries.periodKey, item.periodKey),
				eq(scheduledEmailDeliveries.thresholdDays, item.thresholdDays),
			),
		)
		.limit(1);

	if (
		existing?.status === SCHEDULED_EMAIL_DELIVERY_STATUSES.FAILED &&
		existing.updatedAt &&
		Date.now() - new Date(existing.updatedAt).getTime() > 60 * 60 * 1000
	) {
		const [retried] = await database
			.update(scheduledEmailDeliveries)
			.set({
				status: SCHEDULED_EMAIL_DELIVERY_STATUSES.CLAIMED,
				updatedAt: new Date(),
			})
			.where(eq(scheduledEmailDeliveries.id, existing.id))
			.returning();
		if (retried) return { state: "claimed", id: retried.id };
	}

	return { state: "duplicate" };
}

export async function runScheduledReminderJob(
	options: { now?: Date; db?: Database; ownerId?: string } = {},
): Promise<ScheduledReminderJobResult> {
	const database = options.db ?? defaultDb;
	const now = options.now ?? new Date();
	const localToday = getLocalDateKey(now);
	const rows = await queryRentCycleRows(database, now, options.ownerId);
	const result: ScheduledReminderJobResult = {
		evaluated: 0,
		claimed: 0,
		sent: 0,
		failed: 0,
		preferenceSkipped: 0,
		suppressionSkipped: 0,
		duplicateSkipped: 0,
	};

	for (const row of rows) {
		const items = computeRentCycleItem(row, localToday);
		result.evaluated += items.length;
		for (const item of items) {
			if (!preferenceEnabled(item)) {
				result.preferenceSkipped += 1;
				continue;
			}
			if (
				(item.type === SCHEDULED_EMAIL_TYPES.RENT_DUE ||
					item.type === SCHEDULED_EMAIL_TYPES.OVERDUE) &&
				item.row.suppressedPeriodKeys.includes(item.periodKey)
			) {
				result.suppressionSkipped += 1;
				continue;
			}

			const claim = await claimDelivery(database, item);
			if (claim.state === "duplicate") {
				result.duplicateSkipped += 1;
				continue;
			}
			result.claimed += 1;
			if (!claim.id) throw new Error("SCHEDULED_EMAIL_CLAIM_ID_MISSING");
			try {
				await sendReminder(item);
				await database
					.update(scheduledEmailDeliveries)
					.set({
						status: SCHEDULED_EMAIL_DELIVERY_STATUSES.SENT,
						sentAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(scheduledEmailDeliveries.id, claim.id));
				result.sent += 1;
			} catch (error) {
				await database
					.update(scheduledEmailDeliveries)
					.set({
						status: SCHEDULED_EMAIL_DELIVERY_STATUSES.FAILED,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(scheduledEmailDeliveries.ownerId, item.row.ownerId),
							eq(scheduledEmailDeliveries.id, claim.id),
							eq(scheduledEmailDeliveries.type, item.type),
							eq(scheduledEmailDeliveries.periodKey, item.periodKey),
							eq(scheduledEmailDeliveries.thresholdDays, item.thresholdDays),
						),
					);
				result.failed += 1;
				console.error("[scheduled-reminders] delivery failed", {
					type: item.type,
					leaseId: item.row.leaseId,
					error: error instanceof Error ? error.message : "unknown",
				});
			}
		}
	}

	console.info("[scheduled-reminders] completed", result);
	return result;
}
