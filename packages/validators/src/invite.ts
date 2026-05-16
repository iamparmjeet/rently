import { tenantInvites as Invite } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// ******** Invite **********

// Derive Zod Schemas - For Runtime from Drizzle
export const InviteSelectSchema = createSelectSchema(Invite);
export const InviteInsertSchema = createInsertSchema(Invite);

// Business Logic Schemas (API Consumers)
export const CreateInviteSchema = InviteInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	status: true,
	token: true,
	invitedById: true,
});

export const UpdateInviteSchema = InviteSelectSchema.partial().pick({
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

// OutPUT Schemas (API Returns)
export const InvitePublicSchema = InviteSelectSchema.omit({
	token: true,
	notes: true,
	invitedById: true,
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
	}),
});

export const ReferrerSchema = z.object({
	id: z.uuid(),
	referredUserId: z.uuid(),
	note: z.string().optional(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const CreateReferrerSchema = ReferrerSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateReferrerSchema = ReferrerSchema.partial().pick({
	referredUserId: true,
	note: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type TenantInvite = z.infer<typeof InviteSelectSchema>;
export type NewTenantInvite = z.infer<typeof InviteInsertSchema>;
export type AcceptInvite = z.infer<typeof AcceptInviteSchema>;
