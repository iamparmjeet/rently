import { createDb } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_TARGET_TYPES,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	PAYMENT_METHODS,
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { ACCOUNT_MODES } from "@rently/db/constants/workspace-modes";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { invoices, plans, subscriptions } from "@rently/db/schema/subscription";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

// Regression rationale (mistaken subscription-payment correction):
// The only prior way to "fix" a wrong subscription payment was to rewrite or
// delete the invoice, which destroys financial history. This slice adds an
// immutable correction: a linked negative-amount invoice nets the paid total to
// zero while the original keeps its amount/reference/timestamps, and the audit
// trail records the actor and reason. These tests pin the safety boundaries:
//   - the reversal is linked and negative, and revenue nets to zero,
//   - the granted window is revoked so entitlement stops (no paid-but-unentitled
//     or unpaid-but-entitled drift),
//   - a repeat correction is a CONFLICT, not a second reversal,
//   - only the LATEST paid invoice is correctable (older ones have later
//     renewals on top and no recorded prior state),
//   - demo/sample identities, non-owners, and unknown invoices are refused
//     without writing anything.

import {
	correctSubscriptionPayment,
	recordSubscriptionPayment,
} from "../../modules/admin/subscriptions";
import { getOwnerEntitlement } from "../helpers/tenant-limit";

const db = createDb();

const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];

async function createUser(
	role: (typeof USER_ROLES)[keyof typeof USER_ROLES],
	accountMode: string = ACCOUNT_MODES.STANDARD,
) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name: "Correction User",
		email: `${id}@correction.keyhq.invalid`,
		role,
		accountMode,
	});
	return id;
}

async function createPlan() {
	const id = crypto.randomUUID();
	createdPlanIds.push(id);
	await db.insert(plans).values({
		id,
		name: "Correction Plan",
		slug: `correction-${id}`,
		tenantLimit: 5,
		priceMonthly: 49_900,
	});
	return id;
}

async function createSubscription(
	ownerId: string,
	planId: string,
	currentPeriodEnd: Date,
) {
	const id = crypto.randomUUID();
	createdSubscriptionIds.push(id);
	await db.insert(subscriptions).values({
		id,
		userId: ownerId,
		planId,
		status: PLAN_STATUS.ACTIVE,
		billingInterval: BILLING_INTERVAL.MONTHLY,
		currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
		currentPeriodEnd,
		totalPaid: 0,
	});
	return id;
}

function paymentInput(
	ownerUserId: string,
	planId: string,
	priceMonthly: number,
	paidAt: Date,
) {
	return {
		ownerUserId,
		planId,
		billingInterval: BILLING_INTERVAL.MONTHLY,
		amount: priceMonthly,
		paymentMethod: PAYMENT_METHODS.UPI,
		externalPaymentReference: `UTR${crypto.randomUUID().slice(0, 12)}`,
		paidAt,
		reason: "Correction fixture payment",
	};
}

afterEach(async () => {
	if (createdSubscriptionIds.length > 0) {
		await db
			.delete(adminAuditLogs)
			.where(
				and(
					eq(adminAuditLogs.targetType, ADMIN_TARGET_TYPES.SUBSCRIPTION),
					inArray(adminAuditLogs.targetId, createdSubscriptionIds),
				),
			);
		await db
			.delete(invoices)
			.where(inArray(invoices.subscriptionId, createdSubscriptionIds));
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.id, createdSubscriptionIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(invoices).where(inArray(invoices.userId, createdUserIds));
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	createdSubscriptionIds.length = 0;
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
});

describe("correct subscription payment", () => {
	it("links a negative reversal, nets the paid total, and revokes the granted window", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		// Lapsed period, so the recorded payment grants a fresh window that the
		// correction must revoke.
		const subscriptionId = await createSubscription(
			ownerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);

		const { invoice } = await recordSubscriptionPayment(
			db,
			adminId,
			paymentInput(
				ownerId,
				planId,
				49_900,
				new Date("2026-09-05T08:00:00.000Z"),
			),
		);

		const result = await correctSubscriptionPayment(db, adminId, {
			ownerUserId: ownerId,
			invoiceId: invoice.id,
			reason: "Payment was recorded against the wrong owner by mistake.",
		});

		expect(result.originalInvoiceId).toBe(invoice.id);
		expect(result.reversal.amount).toBe(-49_900);
		expect(result.reversal.paymentStatus).toBe(PAYMENT_STATUS.PAID);

		// Revenue nets to zero: original paid invoice and its reversal are the
		// only paid rows for this owner.
		const paidRows = await db
			.select({ amount: invoices.amount })
			.from(invoices)
			.where(
				and(
					eq(invoices.userId, ownerId),
					eq(invoices.paymentStatus, PAYMENT_STATUS.PAID),
				),
			);
		expect(paidRows.reduce((sum, row) => sum + row.amount, 0)).toBe(0);

		const [stored] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(stored?.totalPaid).toBe(0);

		// The revoked window ended in the past, so the owner is no longer entitled.
		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: false,
			tenantLimit: 0,
		});

		const audits = await db
			.select()
			.from(adminAuditLogs)
			.where(
				and(
					eq(adminAuditLogs.targetId, subscriptionId),
					eq(
						adminAuditLogs.action,
						ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_CORRECTED,
					),
				),
			);
		expect(audits).toHaveLength(1);
		expect(audits[0]).toMatchObject({
			actorAdminUserId: adminId,
			reason: "Payment was recorded against the wrong owner by mistake.",
		});
		expect(audits[0]?.metadata).toMatchObject({
			originalInvoiceId: invoice.id,
			amount: 49_900,
		});
	});

	it("refuses a repeat correction as a conflict", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(
			ownerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);
		const { invoice } = await recordSubscriptionPayment(
			db,
			adminId,
			paymentInput(
				ownerId,
				planId,
				49_900,
				new Date("2026-09-05T08:00:00.000Z"),
			),
		);

		await correctSubscriptionPayment(db, adminId, {
			ownerUserId: ownerId,
			invoiceId: invoice.id,
			reason: "First correction of the mistaken payment.",
		});

		await expect(
			correctSubscriptionPayment(db, adminId, {
				ownerUserId: ownerId,
				invoiceId: invoice.id,
				reason: "Retry the same correction request.",
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		const reversals = await db
			.select({ id: invoices.id })
			.from(invoices)
			.where(eq(invoices.reversesInvoiceId, invoice.id));
		expect(reversals).toHaveLength(1);
		const [stored] = await db
			.select({ totalPaid: subscriptions.totalPaid })
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(stored?.totalPaid).toBe(0);
	});

	it("refuses correcting a non-latest paid invoice and writes nothing", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(
			ownerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);

		const first = await recordSubscriptionPayment(
			db,
			adminId,
			paymentInput(
				ownerId,
				planId,
				49_900,
				new Date("2026-09-05T08:00:00.000Z"),
			),
		);
		await recordSubscriptionPayment(
			db,
			adminId,
			paymentInput(
				ownerId,
				planId,
				49_900,
				new Date("2026-09-10T08:00:00.000Z"),
			),
		);

		await expect(
			correctSubscriptionPayment(db, adminId, {
				ownerUserId: ownerId,
				invoiceId: first.invoice.id,
				reason: "Attempt to correct an older payment under a later one.",
			}),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const reversals = await db
			.select({ id: invoices.id })
			.from(invoices)
			.where(eq(invoices.reversesInvoiceId, first.invoice.id));
		expect(reversals).toHaveLength(0);
		const [stored] = await db
			.select({ totalPaid: subscriptions.totalPaid })
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(stored?.totalPaid).toBe(49_900 * 2);
	});

	it("ignores a newer negative paid row when selecting the correctable payment", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(
			ownerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);
		const { invoice } = await recordSubscriptionPayment(
			db,
			adminId,
			paymentInput(
				ownerId,
				planId,
				49_900,
				new Date("2026-09-05T08:00:00.000Z"),
			),
		);

		// A malformed historical row must neither become the correction target nor
		// hide the latest positive payment from the correction command.
		await db.insert(invoices).values({
			id: crypto.randomUUID(),
			subscriptionId,
			userId: ownerId,
			amount: -49_900,
			periodStart: new Date("2026-09-05T08:00:00.000Z"),
			periodEnd: new Date("2026-10-05T08:00:00.000Z"),
			paymentStatus: PAYMENT_STATUS.PAID,
			paidAt: new Date("2026-09-06T08:00:00.000Z"),
		});

		const result = await correctSubscriptionPayment(db, adminId, {
			ownerUserId: ownerId,
			invoiceId: invoice.id,
			reason:
				"Remove the valid payment despite a malformed negative ledger row.",
		});

		expect(result.reversal.amount).toBe(-49_900);
		const [stored] = await db
			.select({ totalPaid: subscriptions.totalPaid })
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(stored?.totalPaid).toBe(0);
	});

	it("refuses demo identities, non-owners, and unknown invoices", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const demoOwnerId = await createUser(
			USER_ROLES.OWNER,
			ACCOUNT_MODES.PUBLIC_DEMO,
		);
		const planId = await createPlan();
		await createSubscription(
			demoOwnerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);

		await expect(
			correctSubscriptionPayment(db, adminId, {
				ownerUserId: demoOwnerId,
				invoiceId: crypto.randomUUID(),
				reason: "Attempt to correct a demo identity payment.",
			}),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const tenantId = await createUser(USER_ROLES.TENANT);
		await expect(
			correctSubscriptionPayment(db, adminId, {
				ownerUserId: tenantId,
				invoiceId: crypto.randomUUID(),
				reason: "Attempt to correct a tenant as if an owner.",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const ownerId = await createUser(USER_ROLES.OWNER);
		await createSubscription(
			ownerId,
			planId,
			new Date("2026-08-01T00:00:00.000Z"),
		);
		await expect(
			correctSubscriptionPayment(db, adminId, {
				ownerUserId: ownerId,
				invoiceId: crypto.randomUUID(),
				reason: "Attempt to correct an invoice id that does not exist.",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
