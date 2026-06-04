import { timestamp, uuid } from "drizzle-orm/pg-core";
import { generatedId } from "./id";

/**
 * Standard primary key column using UUIDv7
 * - Uses uuid type (16 bytes binary, NOT text 36 bytes)
 * - Application-side generation with $defaultFn
 * - Works with all Postgres versions, no extension needed
 */

export const idColumn = () => ({
	id: uuid("id")
		.primaryKey()
		.$defaultFn(() => generatedId())
		.notNull(),
});

export const auditColumns = () => ({
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date()),
});

export const softDeleteColumn = () => ({
	deletedAt: timestamp("deleted_at"), // null = active
});
