import type { Database } from "@rently/db";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import type { AdminAuditLogListInput } from "@rently/validators";
import { and, count, desc, eq, type SQL } from "drizzle-orm";

export async function queryAdminAuditLogs(
	db: Database,
	input: AdminAuditLogListInput,
) {
	const conditions: SQL[] = [];
	if (input.actorAdminUserId) {
		conditions.push(
			eq(adminAuditLogs.actorAdminUserId, input.actorAdminUserId),
		);
	}
	if (input.action) conditions.push(eq(adminAuditLogs.action, input.action));
	if (input.targetType) {
		conditions.push(eq(adminAuditLogs.targetType, input.targetType));
	}

	const whereCondition = conditions.length ? and(...conditions) : undefined;
	const offset = (input.page - 1) * input.pageSize;

	const [[totalRow], rows] = await Promise.all([
		db.select({ value: count() }).from(adminAuditLogs).where(whereCondition),
		db
			.select({
				id: adminAuditLogs.id,
				actorAdminUserId: adminAuditLogs.actorAdminUserId,
				actorAdminName: user.name,
				actorAdminEmail: user.email,
				action: adminAuditLogs.action,
				targetType: adminAuditLogs.targetType,
				targetId: adminAuditLogs.targetId,
				reason: adminAuditLogs.reason,
				metadata: adminAuditLogs.metadata,
				createdAt: adminAuditLogs.createdAt,
			})
			.from(adminAuditLogs)
			.innerJoin(user, eq(adminAuditLogs.actorAdminUserId, user.id))
			.where(whereCondition)
			.orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
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
