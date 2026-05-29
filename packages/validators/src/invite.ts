import { referrers, tenantInvites } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ******** Invite **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime from Drizzle
export const InviteSelectSchema = createSelectSchema(tenantInvites);
export const InviteInsertSchema = createInsertSchema(tenantInvites);

export const ReferrerSelectSchema = createSelectSchema(referrers);
export const ReferrerInsertSchema = createInsertSchema(referrers);

// ── Layer 2: API input schemas
// Business Logic Schemas (API Consumers)
export const CreateInviteSchema = InviteInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	status: true,
	token: true,
	invitedById: true,
});

export const UpdateInviteSchema = createUpdateSchema(tenantInvites).pick({
	status: true,
});

export const AcceptInviteSchema = z.object({
	token: z.uuid("Invalid invite link"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Must contain uppercase")
		.regex(/[a-z]/, "Must contain lowercase")
		.regex(/[0-9]/, "Must contain a number"),
	// email: z.email(),
	phone: z.string().optional(),
});

export const CreateReferrerSchema = ReferrerInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateReferrerSchema = createUpdateSchema(referrers).pick({
	referredUserId: true,
	note: true,
});

// ── Layer 3: API output schemas
// OutPUT Schemas (API Returns)
export const InvitePublicSchema = InviteSelectSchema.omit({
	token: true,
	notes: true,
	invitedById: true,
	createdAt: true,
	updatedAt: true,
});

export const InviteListItemSchema = InviteSelectSchema.pick({
	id: true,
	email: true,
	name: true,
	status: true,
	createdAt: true,
});

// detail view
export const InviteDetailSchema = InvitePublicSchema.extend({
	invitedBy: z.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string(),
		ownerName: z.string(),
	}),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type TenantInvite = z.infer<typeof InviteSelectSchema>;
export type NewTenantInvite = z.infer<typeof InviteInsertSchema>;
export type AcceptInvite = z.infer<typeof AcceptInviteSchema>;
