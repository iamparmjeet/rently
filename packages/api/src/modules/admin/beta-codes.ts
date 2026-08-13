import { ORPCError } from "@orpc/server";
import { type Database, supportsDatabaseBatch } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_TARGET_TYPES,
	BETA_CODE_FILTERS,
} from "@rently/db/constants/admin-constants";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { betaAccessCodes, plans } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import type {
	AdminBetaCodeListInput,
	CreateAdminBetaCodeInput,
	ExpireAdminBetaCodeInput,
} from "@rently/validators";
import {
	and,
	count,
	desc,
	eq,
	gt,
	ilike,
	isNull,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

export async function queryAdminBetaCodes(
	db: Database,
	input: AdminBetaCodeListInput,
	now = new Date(),
) {
	const conditions: SQL[] = [];

	if (input.search) {
		conditions.push(ilike(betaAccessCodes.code, `%${input.search}%`));
	}

	switch (input.status) {
		case BETA_CODE_FILTERS.ACTIVE:
			conditions.push(
				and(
					or(
						isNull(betaAccessCodes.expiresAt),
						gt(betaAccessCodes.expiresAt, now),
					),
					sql`${betaAccessCodes.totalUses} < ${betaAccessCodes.maxUses}`,
				) as SQL,
			);
			break;
		case BETA_CODE_FILTERS.EXPIRED:
			conditions.push(lte(betaAccessCodes.expiresAt, now));
			break;
		case BETA_CODE_FILTERS.EXHAUSTED:
			conditions.push(
				sql`${betaAccessCodes.totalUses} >= ${betaAccessCodes.maxUses}`,
			);
			break;
		case BETA_CODE_FILTERS.UNUSED:
			conditions.push(eq(betaAccessCodes.totalUses, 0));
			break;
		case BETA_CODE_FILTERS.ALL:
			break;
	}

	const whereCondition = conditions.length ? and(...conditions) : undefined;
	const offset = (input.page - 1) * input.pageSize;

	const [[totalRow], rows] = await Promise.all([
		db.select({ value: count() }).from(betaAccessCodes).where(whereCondition),
		db
			.select({
				id: betaAccessCodes.id,
				code: betaAccessCodes.code,
				grantsPlanSlug: betaAccessCodes.grantsPlanSlug,
				periodDays: betaAccessCodes.periodDays,
				maxUses: betaAccessCodes.maxUses,
				totalUses: betaAccessCodes.totalUses,
				usedByUserId: betaAccessCodes.usedByUserId,
				usedByName: user.name,
				usedByEmail: user.email,
				usedAt: betaAccessCodes.usedAt,
				expiresAt: betaAccessCodes.expiresAt,
				createdAt: betaAccessCodes.createdAt,
				state: sql<"active" | "expired" | "exhausted">`case
						when ${betaAccessCodes.totalUses} >= ${betaAccessCodes.maxUses} then 'exhausted'
						when ${betaAccessCodes.expiresAt} is not null and ${betaAccessCodes.expiresAt} <= ${now} then 'expired'
						else 'active'
					end`,
			})
			.from(betaAccessCodes)
			.leftJoin(user, eq(betaAccessCodes.usedByUserId, user.id))
			.where(whereCondition)
			.orderBy(desc(betaAccessCodes.createdAt), desc(betaAccessCodes.id))
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

function generateBetaCode(): string {
	const random = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
	return `KEYHQ-${random.toUpperCase()}`;
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

export async function createAdminBetaCode(
	db: Database,
	adminUserId: string,
	input: CreateAdminBetaCodeInput,
) {
	const [plan] = await db
		.select({ id: plans.id, slug: plans.slug })
		.from(plans)
		.where(eq(plans.slug, input.grantsPlanSlug))
		.limit(1);

	if (!plan?.slug) {
		throw new ORPCError("NOT_FOUND", {
			message: "Subscription plan not found.",
		});
	}
	if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Beta-code expiry must be in the future.",
		});
	}

	const id = generatedId();
	const code = generateBetaCode();
	const auditId = generatedId();
	const values = {
		id,
		code,
		grantsPlanSlug: plan.slug,
		periodDays: input.periodDays,
		maxUses: input.maxUses,
		expiresAt: input.expiresAt,
	};

	const insertCode = (database: Database) =>
		database.insert(betaAccessCodes).values(values).returning();
	const insertAudit = (database: Database) =>
		database.insert(adminAuditLogs).values({
			id: auditId,
			actorAdminUserId: adminUserId,
			action: ADMIN_AUDIT_ACTIONS.BETA_CODE_CREATED,
			targetType: ADMIN_TARGET_TYPES.BETA_CODE,
			targetId: id,
			reason: input.reason,
			metadata: {
				grantsPlanSlug: plan.slug,
				periodDays: input.periodDays,
				maxUses: input.maxUses,
				expiresAt: input.expiresAt?.toISOString() ?? null,
			},
		});

	let created: typeof betaAccessCodes.$inferSelect | undefined;
	if (supportsDatabaseBatch(db)) {
		const [createdRows] = await db.batch([insertCode(db), insertAudit(db)]);
		created = createdRows[0];
	} else {
		created = await db.transaction(async (tx) => {
			const transactionDb = tx as unknown as Database;
			const [row] = await insertCode(transactionDb);
			await insertAudit(transactionDb);
			return row;
		});
	}

	if (!created) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Beta code could not be created.",
		});
	}

	return {
		betaCode: {
			...created,
			usedByName: null,
			usedByEmail: null,
			state: "active" as const,
		},
	};
}

export async function expireAdminBetaCode(
	db: Database,
	adminUserId: string,
	input: ExpireAdminBetaCodeInput,
) {
	const [existing] = await db
		.select()
		.from(betaAccessCodes)
		.where(eq(betaAccessCodes.id, input.betaCodeId))
		.limit(1);

	if (!existing) {
		throw new ORPCError("NOT_FOUND", { message: "Beta code not found." });
	}

	const now = new Date();
	if (existing.expiresAt && existing.expiresAt <= now) {
		throw new ORPCError("CONFLICT", {
			message: "Beta code is already expired.",
		});
	}

	const auditId = generatedId();
	const updateCode = (database: Database) =>
		database
			.update(betaAccessCodes)
			.set({ expiresAt: now })
			.where(eq(betaAccessCodes.id, existing.id))
			.returning();
	const insertAudit = (database: Database) =>
		database.insert(adminAuditLogs).values({
			id: auditId,
			actorAdminUserId: adminUserId,
			action: ADMIN_AUDIT_ACTIONS.BETA_CODE_EXPIRED,
			targetType: ADMIN_TARGET_TYPES.BETA_CODE,
			targetId: existing.id,
			reason: input.reason,
			metadata: {
				previousExpiresAt: existing.expiresAt?.toISOString() ?? null,
				expiresAt: now.toISOString(),
				totalUses: existing.totalUses,
			},
		});

	let updated: typeof betaAccessCodes.$inferSelect | undefined;
	try {
		if (supportsDatabaseBatch(db)) {
			const [updatedRows] = await db.batch([updateCode(db), insertAudit(db)]);
			updated = updatedRows[0];
		} else {
			updated = await db.transaction(async (tx) => {
				const transactionDb = tx as unknown as Database;
				const [row] = await updateCode(transactionDb);
				await insertAudit(transactionDb);
				return row;
			});
		}
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new ORPCError("CONFLICT", {
				message: "Beta code is already expired.",
			});
		}
		throw error;
	}

	if (!updated) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Beta code could not be expired.",
		});
	}

	return { success: true as const };
}
