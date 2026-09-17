import { ORPCError } from "@orpc/server";
import { type Database, supportsDatabaseBatch } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_SUBSCRIPTION_STATUS_FILTERS,
	ADMIN_TARGET_TYPES,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	type BillingInterval,
	CURRENCY_TYPES,
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { ACCOUNT_MODES } from "@rently/db/constants/workspace-modes";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { invoices, plans, subscriptions } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import type {
	AdminInvoice,
	AdminInvoiceListResponse,
	AdminSubscriptionListInput,
	AdminSubscriptionSummary,
	CancelSubscriptionInput,
	CancelSubscriptionResponse,
	CorrectSubscriptionPaymentInput,
	CorrectSubscriptionPaymentResponse,
	RecordSubscriptionPaymentInput,
} from "@rently/validators";
import {
	and,
	count,
	desc,
	eq,
	ilike,
	inArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

function latestSubscriptionQuery(db: Database) {
	return db
		.selectDistinctOn([subscriptions.userId], {
			userId: subscriptions.userId,
			id: subscriptions.id,
			planId: subscriptions.planId,
			status: subscriptions.status,
			billingInterval: subscriptions.billingInterval,
			currentPeriodStart: subscriptions.currentPeriodStart,
			currentPeriodEnd: subscriptions.currentPeriodEnd,
			nextBillingDate: subscriptions.nextBillingDate,
			expired: subscriptions.expired,
			totalPaid: subscriptions.totalPaid,
			currency: subscriptions.currency,
			createdAt: subscriptions.createdAt,
		})
		.from(subscriptions)
		.orderBy(
			subscriptions.userId,
			desc(subscriptions.createdAt),
			desc(subscriptions.id),
		)
		.as("latest_admin_subscription");
}

export async function queryAdminSubscriptions(
	db: Database,
	input: AdminSubscriptionListInput,
) {
	const latestSubscription = latestSubscriptionQuery(db);
	// Demo and sample identities are support-invisible, matching the overview's
	// reporting filter — otherwise disposable accounts appear as paying owners.
	const conditions: SQL[] = [
		eq(user.role, USER_ROLES.OWNER),
		eq(user.accountMode, ACCOUNT_MODES.STANDARD),
	];

	if (input.search) {
		const pattern = `%${input.search}%`;
		const searchCondition = or(
			ilike(user.name, pattern),
			ilike(user.email, pattern),
		);
		if (searchCondition) conditions.push(searchCondition);
	}
	if (input.planSlug) conditions.push(eq(plans.slug, input.planSlug));
	if (input.status === ADMIN_SUBSCRIPTION_STATUS_FILTERS.EXPIRED) {
		conditions.push(eq(latestSubscription.expired, true));
	} else if (input.status) {
		conditions.push(
			and(
				eq(latestSubscription.status, input.status),
				or(
					sql`${latestSubscription.expired} is null`,
					eq(latestSubscription.expired, false),
				),
			) as SQL,
		);
	}

	const whereCondition = and(...conditions);
	const offset = (input.page - 1) * input.pageSize;

	const [[totalRow], rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(user)
			.innerJoin(latestSubscription, eq(latestSubscription.userId, user.id))
			.innerJoin(plans, eq(latestSubscription.planId, plans.id))
			.where(whereCondition),
		db
			.select({
				ownerId: user.id,
				ownerName: user.name,
				ownerEmail: user.email,
				emailVerified: user.emailVerified,
				subscription: {
					id: latestSubscription.id,
					planId: latestSubscription.planId,
					planName: plans.name,
					planSlug: plans.slug,
					status: latestSubscription.status,
					billingInterval: latestSubscription.billingInterval,
					currentPeriodStart: latestSubscription.currentPeriodStart,
					currentPeriodEnd: latestSubscription.currentPeriodEnd,
					nextBillingDate: latestSubscription.nextBillingDate,
					expired: latestSubscription.expired,
					totalPaid: latestSubscription.totalPaid,
					currency: latestSubscription.currency,
				},
			})
			.from(user)
			.innerJoin(latestSubscription, eq(latestSubscription.userId, user.id))
			.innerJoin(plans, eq(latestSubscription.planId, plans.id))
			.where(whereCondition)
			.orderBy(desc(latestSubscription.createdAt), desc(user.id))
			.limit(input.pageSize)
			.offset(offset),
	]);

	const total = totalRow?.value ?? 0;
	return {
		items: rows,
		page: input.page,
		pageSize: input.pageSize,
		total,
		totalPages: Math.ceil(total / input.pageSize),
	};
}

export async function queryAdminOutstandingInvoices(
	db: Database,
	input: { page: number; pageSize: number },
): Promise<AdminInvoiceListResponse> {
	const whereCondition = and(
		eq(user.role, USER_ROLES.OWNER),
		eq(user.accountMode, ACCOUNT_MODES.STANDARD),
		inArray(invoices.paymentStatus, [
			PAYMENT_STATUS.UNPAID,
			PAYMENT_STATUS.FAILED,
		]),
	);
	const offset = (input.page - 1) * input.pageSize;
	const [[totalRow], rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(invoices)
			.innerJoin(user, eq(invoices.userId, user.id))
			.where(whereCondition),
		db
			.select({
				id: invoices.id,
				subscriptionId: invoices.subscriptionId,
				amount: invoices.amount,
				currency: invoices.currency,
				paymentStatus: invoices.paymentStatus,
				paymentMethod: invoices.paymentMethod,
				externalPaymentReference: invoices.externalPaymentReference,
				periodStart: invoices.periodStart,
				periodEnd: invoices.periodEnd,
				paidAt: invoices.paidAt,
				createdAt: invoices.createdAt,
				ownerId: user.id,
				ownerName: user.name,
				ownerEmail: user.email,
			})
			.from(invoices)
			.innerJoin(user, eq(invoices.userId, user.id))
			.where(whereCondition)
			.orderBy(desc(invoices.createdAt), desc(invoices.id))
			.limit(input.pageSize)
			.offset(offset),
	]);
	const total = totalRow?.value ?? 0;

	return {
		items: rows,
		page: input.page,
		pageSize: input.pageSize,
		total,
		totalPages: Math.ceil(total / input.pageSize),
	};
}

type CancelMutationParams = {
	ownerUserId: string;
	adminUserId: string;
	reason: string;
	auditId: string;
};

type CancelMutationRow = {
	subscription: Record<string, unknown> | null;
	target: Record<string, unknown> | null;
};

// Cancel-at-period-end: the subscription status flips to `cancelled` but the
// paid period is untouched, so entitlement (0045) keeps granting access until
// `current_period_end` and lapses afterwards. The conditional UPDATE is the
// arbiter — a second request or a request after the period lapsed matches zero
// rows, and the audit row is written only by the statement that actually
// cancelled. Shares the per-owner advisory lock with payment recording so a
// cancel racing a renewal serializes on one domain.
function cancelSubscriptionSql(params: CancelMutationParams) {
	return sql`
		with target as materialized (
			select s.*, p."name" as "plan_name", p."slug" as "plan_slug"
			from ${subscriptions} s
			join ${plans} p on p."id" = s."plan_id"
			where s."user_id" = ${params.ownerUserId}
			order by s."created_at" desc, s."id" desc
			limit 1
		),
		cancelled as (
			update ${subscriptions} s
			set
				"status" = ${PLAN_STATUS.CANCELLED},
				"updated_at" = now()
			from target t
			where s."id" = t."id"
				and t."status" <> ${PLAN_STATUS.CANCELLED}
				and (
					t."current_period_end" is null
					or t."current_period_end" > (now() at time zone 'utc')
				)
			returning s.*
		),
		audited as (
			insert into ${adminAuditLogs} (
				"id", "actor_admin_user_id", "action", "target_type", "target_id",
				"reason", "metadata"
			)
			select
				${params.auditId}, ${params.adminUserId},
				${ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED},
				${ADMIN_TARGET_TYPES.SUBSCRIPTION}, c."id", ${params.reason},
				jsonb_build_object(
					'ownerUserId', c."user_id",
					'previousStatus', t."status",
					'effectiveAt', c."current_period_end"
				)
			from cancelled c
			join target t on t."id" = c."id"
			returning "id"
		)
		select
			(
				select row_to_json(x)
				from (
					select c.*, t."plan_name", t."plan_slug"
					from cancelled c
					join target t on t."id" = c."id"
				) x
			) as "subscription",
			(select row_to_json(t) from target t) as "target",
			(select count(*) from audited) as "audit_count"
	`;
}

export async function cancelSubscription(
	db: Database,
	adminUserId: string,
	input: CancelSubscriptionInput,
): Promise<CancelSubscriptionResponse> {
	const [[owner], [currentSubscription]] = await Promise.all([
		db
			.select({
				id: user.id,
				role: user.role,
				accountMode: user.accountMode,
			})
			.from(user)
			.where(eq(user.id, input.ownerUserId))
			.limit(1),
		db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.userId, input.ownerUserId))
			.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
			.limit(1),
	]);

	if (!owner || owner.role !== USER_ROLES.OWNER) {
		throw new ORPCError("NOT_FOUND", { message: "Owner account not found." });
	}
	if (owner.accountMode !== ACCOUNT_MODES.STANDARD) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Subscriptions cannot be changed for demo or sample identities.",
		});
	}
	if (!currentSubscription) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Owner has no subscription row. Repair account provisioning first.",
		});
	}
	// Cancel-at-period-end needs a period end to end at. A subscription with no
	// paid period (for example a free plan provisioned with a null end) would
	// stay entitled forever, so refuse instead of inventing an expiry.
	if (
		currentSubscription.status !== PLAN_STATUS.CANCELLED &&
		currentSubscription.currentPeriodEnd === null
	) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"This subscription has no paid period end, so it cannot be cancelled at period end.",
		});
	}

	const params: CancelMutationParams = {
		ownerUserId: owner.id,
		adminUserId,
		reason: input.reason,
		auditId: generatedId(),
	};

	let row: CancelMutationRow | undefined;

	if (supportsDatabaseBatch(db)) {
		const [, result] = await db.batch([
			db.execute(ownerLockSql(input.ownerUserId)),
			db.execute<CancelMutationRow>(cancelSubscriptionSql(params)),
		]);
		row = result.rows[0];
	} else {
		const result = await db.transaction(async (tx) => {
			const transactionDb = tx as unknown as Database;
			await transactionDb.execute(ownerLockSql(input.ownerUserId));
			return transactionDb.execute<CancelMutationRow>(
				cancelSubscriptionSql(params),
			);
		});
		row = result.rows[0];
	}

	// The statement returns the freshly cancelled row, or — when it cancelled
	// nothing — the target it inspected, so a repeat cancel is idempotent and a
	// lapsed period reports a distinct precondition failure.
	const cancelledRow = row?.subscription ?? null;
	const targetRow = row?.target ?? null;
	const subscriptionRow = cancelledRow ?? targetRow;

	if (!subscriptionRow) {
		throw new ORPCError("NOT_FOUND", { message: "Subscription not found." });
	}
	if (!cancelledRow) {
		const targetStatus = asString(subscriptionRow.status);
		if (targetStatus !== PLAN_STATUS.CANCELLED) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "This subscription's paid period has already ended.",
			});
		}
	}

	return {
		subscription: mapSubscription(
			subscriptionRow,
			String(subscriptionRow.plan_name ?? ""),
			asString(subscriptionRow.plan_slug),
		),
		effectiveAt: asDate(subscriptionRow.current_period_end),
	};
}

type PaymentCorrectionParams = {
	ownerUserId: string;
	invoiceId: string;
	adminUserId: string;
	reason: string;
	reversalId: string;
	auditId: string;
};

type PaymentCorrectionRow = {
	reversal: Record<string, unknown> | null;
	subscription: Record<string, unknown> | null;
	target: Record<string, unknown> | null;
	already_reversed: boolean | null;
	is_latest: boolean | null;
};

// Correct a mistaken subscription payment WITHOUT rewriting it. The original
// paid invoice keeps its amount, reference, and timestamps; the correction is a
// new negative-amount invoice linked by `reverses_invoice_id`, so paid-invoice
// sums net to zero and the audit chain stays intact. The subscription's granted
// window is revoked: period end/next-billing move back to the invoice's own
// `period_start` (the moment the granted window began), which makes entitlement
// lapse naturally for a lapsed renewal and cannot create overlap.
//
// Deliberately restricted to the LATEST paid invoice: an older correction with
// later renewals on top has no recorded prior state to restore, so it is
// refused rather than guessed. The unique index on `reverses_invoice_id` is the
// one-reversal-per-original arbiter.
function correctSubscriptionPaymentSql(params: PaymentCorrectionParams) {
	return sql`
		with owner_sub as materialized (
			select s."id"
			from ${subscriptions} s
			where s."user_id" = ${params.ownerUserId}
			order by s."created_at" desc, s."id" desc
			limit 1
		),
		target as materialized (
			select i.*
			from ${invoices} i
			where i."id" = ${params.invoiceId}
				and i."user_id" = ${params.ownerUserId}
				and i."payment_status" = ${PAYMENT_STATUS.PAID}
				and i."amount" > 0
				and i."reverses_invoice_id" is null
		),
		latest_paid as (
			select i."id"
			from ${invoices} i
			where i."user_id" = ${params.ownerUserId}
				and i."payment_status" = ${PAYMENT_STATUS.PAID}
				and i."amount" > 0
				and i."reverses_invoice_id" is null
			order by
				coalesce(i."paid_at", i."created_at") desc,
				i."created_at" desc,
				i."id" desc
			limit 1
		),
		reversal as (
			insert into ${invoices} (
				"id", "subscription_id", "user_id", "amount", "currency",
				"period_start", "period_end", "payment_status", "payment_method",
				"external_payment_reference", "paid_at", "recorded_by_admin_user_id",
				"reverses_invoice_id"
			)
			select
				${params.reversalId}, os."id", t."user_id", -(t."amount"), t."currency",
				t."period_start", t."period_end", ${PAYMENT_STATUS.PAID},
				t."payment_method", null, now(), ${params.adminUserId}, t."id"
			from target t
			join owner_sub os on true
			where t."id" = (select "id" from latest_paid)
				and not exists (
					select 1 from ${invoices} r where r."reverses_invoice_id" = t."id"
				)
			returning *
		),
		updated_sub as (
			update ${subscriptions} s
			set
				"total_paid" = greatest(coalesce(s."total_paid", 0) - t."amount", 0),
				"current_period_start" = (t."period_start" at time zone 'utc'),
				"current_period_end" = (t."period_start" at time zone 'utc'),
				"next_billing_date" = (t."period_start" at time zone 'utc'),
				"updated_at" = now()
			from reversal r
			join target t on t."id" = r."reverses_invoice_id"
			where s."id" = r."subscription_id"
			returning s.*
		),
		audited as (
			insert into ${adminAuditLogs} (
				"id", "actor_admin_user_id", "action", "target_type", "target_id",
				"reason", "metadata"
			)
			select
				${params.auditId}, ${params.adminUserId},
				${ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_CORRECTED},
				${ADMIN_TARGET_TYPES.SUBSCRIPTION}, r."subscription_id", ${params.reason},
				jsonb_build_object(
					'ownerUserId', r."user_id",
					'originalInvoiceId', t."id",
					'reversalInvoiceId', r."id",
					'amount', t."amount"
				)
			from reversal r
			join target t on t."id" = r."reverses_invoice_id"
			returning "id"
		)
		select
			(select row_to_json(r) from reversal r) as "reversal",
			(select row_to_json(s) from updated_sub s) as "subscription",
			(select row_to_json(t) from target t) as "target",
			(
				select exists (
					select 1 from ${invoices} x where x."reverses_invoice_id" = t."id"
				)
				from target t
			) as "already_reversed",
			(
				select (t."id" = (select "id" from latest_paid))
				from target t
			) as "is_latest",
			(select count(*) from audited) as "audit_count"
	`;
}

export async function correctSubscriptionPayment(
	db: Database,
	adminUserId: string,
	input: CorrectSubscriptionPaymentInput,
): Promise<CorrectSubscriptionPaymentResponse> {
	const [[owner], [subRow]] = await Promise.all([
		db
			.select({
				id: user.id,
				role: user.role,
				accountMode: user.accountMode,
			})
			.from(user)
			.where(eq(user.id, input.ownerUserId))
			.limit(1),
		db
			.select({ planName: plans.name, planSlug: plans.slug })
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.userId, input.ownerUserId))
			.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
			.limit(1),
	]);

	if (!owner || owner.role !== USER_ROLES.OWNER) {
		throw new ORPCError("NOT_FOUND", { message: "Owner account not found." });
	}
	if (owner.accountMode !== ACCOUNT_MODES.STANDARD) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Payments cannot be corrected for demo or sample identities.",
		});
	}
	if (!subRow) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Owner has no subscription row. Repair account provisioning first.",
		});
	}

	const params: PaymentCorrectionParams = {
		ownerUserId: owner.id,
		invoiceId: input.invoiceId,
		adminUserId,
		reason: input.reason,
		reversalId: generatedId(),
		auditId: generatedId(),
	};

	let row: PaymentCorrectionRow | undefined;

	if (supportsDatabaseBatch(db)) {
		const [, result] = await db.batch([
			db.execute(ownerLockSql(input.ownerUserId)),
			db.execute<PaymentCorrectionRow>(correctSubscriptionPaymentSql(params)),
		]);
		row = result.rows[0];
	} else {
		const result = await db.transaction(async (tx) => {
			const transactionDb = tx as unknown as Database;
			await transactionDb.execute(ownerLockSql(input.ownerUserId));
			return transactionDb.execute<PaymentCorrectionRow>(
				correctSubscriptionPaymentSql(params),
			);
		});
		row = result.rows[0];
	}

	if (!row?.target) {
		throw new ORPCError("NOT_FOUND", {
			message: "That paid invoice was not found for this owner.",
		});
	}
	if (!row.reversal) {
		if (row.already_reversed) {
			throw new ORPCError("CONFLICT", {
				message: "This invoice has already been corrected.",
			});
		}
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Only the most recent paid invoice can be corrected. Correct later payments first.",
		});
	}
	if (!row.subscription) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Payment could not be corrected.",
		});
	}

	return {
		originalInvoiceId: String(row.target.id),
		reversal: mapInvoice(row.reversal),
		subscription: mapSubscription(
			row.subscription,
			subRow.planName,
			subRow.planSlug,
		),
	};
}

function getPlanPrice(
	plan: typeof plans.$inferSelect,
	interval: BillingInterval,
): number {
	switch (interval) {
		case BILLING_INTERVAL.MONTHLY:
			return plan.priceMonthly;
		case BILLING_INTERVAL.QUARTERLY:
			return plan.priceQuarterly;
		case BILLING_INTERVAL.HALFYEAR:
			return plan.priceHalfYearly;
		case BILLING_INTERVAL.YEAR:
			return plan.priceYearly;
		case BILLING_INTERVAL.TWOYEAR:
			return plan.priceTwoYear;
	}
}

function getIntervalMonths(interval: BillingInterval): number {
	switch (interval) {
		case BILLING_INTERVAL.MONTHLY:
			return 1;
		case BILLING_INTERVAL.QUARTERLY:
			return 3;
		case BILLING_INTERVAL.HALFYEAR:
			return 6;
		case BILLING_INTERVAL.YEAR:
			return 12;
		case BILLING_INTERVAL.TWOYEAR:
			return 24;
	}
}

function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: string }).code === "23505"
		) {
			return true;
		}
		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: undefined;
	}
	return false;
}

export async function recordSubscriptionPayment(
	db: Database,
	adminUserId: string,
	input: RecordSubscriptionPaymentInput,
) {
	const [[owner], [plan], [currentSubscription], [duplicateReference]] =
		await Promise.all([
			db
				.select({
					id: user.id,
					role: user.role,
					accountMode: user.accountMode,
				})
				.from(user)
				.where(eq(user.id, input.ownerUserId))
				.limit(1),
			db.select().from(plans).where(eq(plans.id, input.planId)).limit(1),
			db
				.select()
				.from(subscriptions)
				.where(eq(subscriptions.userId, input.ownerUserId))
				.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
				.limit(1),
			db
				.select({ id: invoices.id })
				.from(invoices)
				.where(
					eq(invoices.externalPaymentReference, input.externalPaymentReference),
				)
				.limit(1),
		]);

	if (!owner || owner.role !== USER_ROLES.OWNER) {
		throw new ORPCError("NOT_FOUND", { message: "Owner account not found." });
	}
	if (owner.accountMode !== ACCOUNT_MODES.STANDARD) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Payments cannot be recorded against demo or sample identities.",
		});
	}
	if (!plan) {
		throw new ORPCError("NOT_FOUND", {
			message: "Subscription plan not found.",
		});
	}
	if (!currentSubscription) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Owner has no subscription row. Repair account provisioning first.",
		});
	}
	if (duplicateReference) {
		throw new ORPCError("CONFLICT", {
			message: "This external payment reference has already been recorded.",
		});
	}

	const expectedAmount = getPlanPrice(plan, input.billingInterval);
	if (input.amount !== expectedAmount) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Expected ${expectedAmount} paise for this plan and billing interval.`,
		});
	}
	if (input.paidAt.getTime() > Date.now()) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Payment time cannot be in the future.",
		});
	}

	const intervalMonths = getIntervalMonths(input.billingInterval);
	const invoiceId = generatedId();
	const auditId = generatedId();
	const params: PaymentMutationParams = {
		ownerUserId: owner.id,
		planId: plan.id,
		billingInterval: input.billingInterval,
		amount: input.amount,
		paymentMethod: input.paymentMethod,
		externalPaymentReference: input.externalPaymentReference,
		paidAt: input.paidAt,
		reason: input.reason,
		adminUserId,
		invoiceId,
		auditId,
		intervalMonths,
	};

	try {
		let mutation: PaymentMutationRow | undefined;

		if (supportsDatabaseBatch(db)) {
			const [, result] = await db.batch([
				db.execute(ownerLockSql(input.ownerUserId)),
				db.execute<PaymentMutationRow>(applySubscriptionPaymentSql(params)),
			]);
			mutation = result.rows[0];
		} else {
			const result = await db.transaction(async (tx) => {
				const transactionDb = tx as unknown as Database;
				await transactionDb.execute(ownerLockSql(input.ownerUserId));
				return transactionDb.execute<PaymentMutationRow>(
					applySubscriptionPaymentSql(params),
				);
			});
			mutation = result.rows[0];
		}

		if (!mutation?.invoice || !mutation.subscription) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Payment could not be recorded.",
			});
		}

		return {
			invoice: mapInvoice(mutation.invoice),
			subscription: mapSubscription(
				mutation.subscription,
				plan.name,
				plan.slug,
			),
		};
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		if (isUniqueViolation(error)) {
			throw new ORPCError("CONFLICT", {
				message: "This external payment reference has already been recorded.",
			});
		}
		throw error;
	}
}

type PaymentMutationRow = {
	invoice: Record<string, unknown> | null;
	subscription: Record<string, unknown> | null;
};

type PaymentMutationParams = {
	ownerUserId: string;
	planId: string;
	billingInterval: BillingInterval;
	amount: number;
	paymentMethod: string;
	externalPaymentReference: string;
	paidAt: Date;
	reason: string;
	adminUserId: string;
	invoiceId: string;
	auditId: string;
	intervalMonths: number;
};

// Neon HTTP has no callback transaction or FOR UPDATE, so the lock and the
// mutation are two statements in one transaction/batch: the lock serializes
// every writer for one owner's subscription, and the mutation's snapshot is
// taken after the winner commits — two concurrent payments chain their
// extensions instead of both reading the same period end (B10 precedent).
function ownerLockSql(ownerUserId: string) {
	return sql`select pg_advisory_xact_lock(
		hashtextextended(${`rently:subscription:owner:${ownerUserId}`}, 0)
	)`;
}

// D03: ONE effective start/end pair drives both the granted subscription
// period and the invoice coverage, so an invoice never claims a window the
// payment did not grant. A payment made before the current period ends grants
// the extension that follows it (start = the current period's end — no
// overlap); a payment made after it lapsed (or when the period was never set)
// grants a window starting at the payment itself. The arithmetic runs in SQL
// against the locked row: `make_interval` clamps month-ends (Jan 31 + 1 month
// = Feb 28) where JS `setUTCMonth` would overflow to Mar 3.
function applySubscriptionPaymentSql(params: PaymentMutationParams) {
	// `subscriptions` period columns are `timestamp` (no zone) holding UTC wall
	// clock, while invoice periods and `paid_at` are `timestamptz`. Binding a
	// JS Date lets Postgres coerce through the session zone (IST), which shifted
	// every period by +05:30; pin both representations explicitly instead.
	const paidAtWallClock = params.paidAt
		.toISOString()
		.slice(0, 19)
		.replace("T", " ");
	const paidAtInstant = params.paidAt.toISOString();

	return sql`
		with target as materialized (
			select
				s."id",
				s."plan_id",
				s."current_period_start",
				s."current_period_end"
			from ${subscriptions} s
			where s."user_id" = ${params.ownerUserId}
		),
		calc as materialized (
			select
				t."id",
				t."plan_id" as "from_plan_id",
				t."current_period_start" as "previous_period_start",
				(t."current_period_end" is not null and t."current_period_end" > ${paidAtWallClock}::timestamp) as "early_renewal",
				case
					when t."current_period_end" is not null and t."current_period_end" > ${paidAtWallClock}::timestamp
						then t."current_period_end"
					else ${paidAtWallClock}::timestamp
				end as "effective_start"
			from target t
		),
		updated as (
			update ${subscriptions} s
			set
				"plan_id" = ${params.planId},
				"status" = ${PLAN_STATUS.ACTIVE},
				"expired" = false,
				"billing_interval" = ${params.billingInterval},
				"current_period_start" = case
					when c."early_renewal" then c."previous_period_start"
					else c."effective_start"
				end,
				"current_period_end" = c."effective_start" + make_interval(months => ${params.intervalMonths}::int),
				"next_billing_date" = c."effective_start" + make_interval(months => ${params.intervalMonths}::int),
				"total_paid" = coalesce(s."total_paid", 0) + ${params.amount},
				"currency" = ${CURRENCY_TYPES.INR},
				"updated_at" = now()
			from calc c
			where s."id" = c."id"
			returning s.*
		),
		inserted_invoice as (
			insert into ${invoices} (
				"id", "subscription_id", "user_id", "amount", "currency",
				"period_start", "period_end", "payment_status", "payment_method",
				"external_payment_reference", "paid_at", "recorded_by_admin_user_id"
			)
			select
				${params.invoiceId}, u."id", u."user_id", ${params.amount},
				${CURRENCY_TYPES.INR},
				(c."effective_start" at time zone 'UTC'),
				(u."current_period_end" at time zone 'UTC'),
				${PAYMENT_STATUS.PAID}, ${params.paymentMethod},
				${params.externalPaymentReference}, ${paidAtInstant}::timestamptz,
				${params.adminUserId}
			from updated u
			join calc c on c."id" = u."id"
			returning *
		),
		inserted_audit as (
			insert into ${adminAuditLogs} (
				"id", "actor_admin_user_id", "action", "target_type", "target_id",
				"reason", "metadata"
			)
			select
				${params.auditId}, ${params.adminUserId},
				${ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_RECORDED},
				${ADMIN_TARGET_TYPES.SUBSCRIPTION}, u."id", ${params.reason},
				jsonb_build_object(
					'ownerUserId', u."user_id",
					'fromPlanId', c."from_plan_id",
					'toPlanId', ${params.planId}::uuid,
					'billingInterval', ${params.billingInterval}::text,
					'amount', ${params.amount}::int,
					'paymentMethod', ${params.paymentMethod}::text,
					'externalPaymentReference', ${params.externalPaymentReference}::text
				)
			from updated u
			join calc c on c."id" = u."id"
			returning "id"
		)
		select
			(select row_to_json(i) from inserted_invoice i) as "invoice",
			(select row_to_json(u) from updated u) as "subscription"
	`;
}

function asString(value: unknown): string | null {
	return value === null || value === undefined ? null : String(value);
}

function asNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	return typeof value === "number" ? value : Number(value);
}

function asDate(value: unknown): Date | null {
	if (value === null || value === undefined) return null;
	if (value instanceof Date) return value;
	const text = String(value);
	// `row_to_json` renders a zone-less `timestamp` as "YYYY-MM-DD HH:MM:SS".
	// Those columns hold UTC wall clock, so parse them as UTC — a bare
	// `new Date(text)` would read them in the machine's zone (IST).
	const isWallClock = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(
		text,
	);
	return new Date(isWallClock ? `${text.replace(" ", "T")}Z` : text);
}

function mapInvoice(row: Record<string, unknown>): AdminInvoice {
	return {
		id: String(row.id),
		subscriptionId: asString(row.subscription_id),
		amount: asNumber(row.amount) ?? 0,
		currency: asString(row.currency),
		paymentStatus: asString(
			row.payment_status,
		) as AdminInvoice["paymentStatus"],
		paymentMethod: asString(
			row.payment_method,
		) as AdminInvoice["paymentMethod"],
		externalPaymentReference: asString(row.external_payment_reference),
		periodStart: asDate(row.period_start) as Date,
		periodEnd: asDate(row.period_end) as Date,
		paidAt: asDate(row.paid_at),
		createdAt: asDate(row.created_at) as Date,
		reversesInvoiceId: asString(row.reverses_invoice_id),
	};
}

function mapSubscription(
	row: Record<string, unknown>,
	planName: string,
	planSlug: string | null,
): AdminSubscriptionSummary {
	return {
		id: String(row.id),
		planId: String(row.plan_id),
		planName,
		planSlug,
		status: asString(row.status) as AdminSubscriptionSummary["status"],
		billingInterval: String(
			row.billing_interval,
		) as AdminSubscriptionSummary["billingInterval"],
		currentPeriodStart: asDate(row.current_period_start),
		currentPeriodEnd: asDate(row.current_period_end),
		nextBillingDate: asDate(row.next_billing_date),
		expired:
			row.expired === null || row.expired === undefined
				? null
				: Boolean(row.expired),
		totalPaid: asNumber(row.total_paid),
		currency: asString(row.currency),
	};
}
