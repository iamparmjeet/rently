import type { Database } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	notificationPreferences,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	sendPaymentReceiptEmail,
	sendUtilityBillEmail,
	type UtilityBillLine,
} from "@rently/email";
import { and, eq, inArray } from "drizzle-orm";

async function isPreferenceEnabled(
	db: Database,
	ownerId: string,
	field: "paymentReceived" | "utilityBillGenerated",
): Promise<boolean> {
	const [row] = await db
		.select({ enabled: notificationPreferences[field] })
		.from(notificationPreferences)
		.where(eq(notificationPreferences.ownerId, ownerId))
		.limit(1);
	// Preferences are created lazily. Defaults are intentionally conservative for
	// utility bills while payment receipts are enabled by default.
	return row?.enabled ?? field === "paymentReceived";
}

export async function sendAutomaticPaymentReceipt(
	db: Database,
	ownerId: string,
	paymentId: string,
): Promise<void> {
	try {
		if (!(await isPreferenceEnabled(db, ownerId, "paymentReceived"))) return;
		const [payment] = await db
			.select({
				amount: payments.amount,
				paymentDate: payments.paymentDate,
				paymentType: payments.type,
				paymentMethod: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				tenantEmail: user.email,
				tenantName: user.name,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(
				properties,
				and(
					eq(units.propertyId, properties.id),
					eq(properties.ownerId, ownerId),
				),
			)
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(eq(payments.id, paymentId))
			.limit(1);
		const [owner] = await db
			.select({ name: user.name })
			.from(user)
			.where(eq(user.id, ownerId))
			.limit(1);
		if (!payment || !owner || payment.paymentType === "reversal") return;
		await sendPaymentReceiptEmail({
			to: payment.tenantEmail,
			tenantName: payment.tenantName,
			ownerName: owner.name,
			propertyName: payment.propertyName,
			unitNumber: payment.unitNumber,
			amount: payment.amount,
			paymentDate: payment.paymentDate,
			paymentType: payment.paymentType,
			paymentMethod: payment.paymentMethod,
			referenceNumber: payment.referenceNumber,
		});
	} catch (error) {
		console.error("[automatic-email] payment receipt failed", {
			paymentId,
			error,
		});
	}
}

export async function sendAutomaticUtilityBillEmail({
	db,
	ownerId,
	utilityIds,
	batchId,
}: {
	db: Database;
	ownerId: string;
	utilityIds?: string[];
	batchId?: string;
}): Promise<void> {
	try {
		if (!(await isPreferenceEnabled(db, ownerId, "utilityBillGenerated")))
			return;
		const filter = utilityIds?.length
			? inArray(utilities.id, utilityIds)
			: batchId
				? eq(utilities.batchId, batchId)
				: undefined;
		if (!filter) return;
		const rows = await db
			.select({
				utilityType: utilities.utilityType,
				totalAmount: utilities.totalAmount,
				currentReading: utilities.currentReading,
				previousReading: utilities.previousReading,
				unitsUsed: utilities.unitsUsed,
				currentReadingDate: utilities.currentReadingDate,
				description: utilities.description,
				tenantEmail: user.email,
				tenantName: user.name,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
				billingDate: utilities.currentReadingDate,
			})
			.from(utilities)
			.innerJoin(leases, eq(utilities.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(
				properties,
				and(
					eq(units.propertyId, properties.id),
					eq(properties.ownerId, ownerId),
				),
			)
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(filter);
		if (rows.length === 0) return;
		const [owner] = await db
			.select({ name: user.name })
			.from(user)
			.where(eq(user.id, ownerId))
			.limit(1);
		if (!owner) return;
		const first = rows[0];
		if (!first) return;
		const utilitiesForEmail: UtilityBillLine[] = rows.map(
			({
				utilityType,
				totalAmount,
				currentReading,
				previousReading,
				unitsUsed,
				currentReadingDate,
				description,
			}) => ({
				utilityType,
				totalAmount,
				currentReading,
				previousReading,
				unitsUsed,
				currentReadingDate,
				description,
			}),
		);
		await sendUtilityBillEmail({
			to: first.tenantEmail,
			tenantName: first.tenantName,
			ownerName: owner.name,
			propertyName: first.propertyName,
			unitNumber: first.unitNumber,
			billingDate: first.billingDate,
			utilities: utilitiesForEmail,
		});
	} catch (error) {
		console.error("[automatic-email] utility bill failed", {
			utilityIds,
			batchId,
			error,
		});
	}
}
