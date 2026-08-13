import { sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { idColumn } from "../utils/columns";
import { user } from "./auth";

export const adminAuditLogs = pgTable(
	"admin_audit_logs",
	{
		...idColumn(),
		actorAdminUserId: uuid("actor_admin_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		action: text("action").notNull(),
		targetType: text("target_type").notNull(),
		targetId: uuid("target_id"),
		reason: text("reason").notNull(),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("admin_audit_logs_actor_created_at_idx").on(
			table.actorAdminUserId,
			table.createdAt,
		),
		index("admin_audit_logs_target_idx").on(table.targetType, table.targetId),
		uniqueIndex("admin_audit_logs_one_beta_expiry_idx")
			.on(table.targetId)
			.where(sql`${table.action} = 'beta_code.expired'`),
	],
);
