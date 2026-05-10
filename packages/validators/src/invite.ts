import { tenantInvites as Invite } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// ******** Invite **********

// Derive Zod Schemas - For Runtime
export const InviteSelectSchema = createSelectSchema(Invite);
export const InviteInsertSchema = createInsertSchema(Invite);

// Business Logic Schemas
export const CreateInviteSchema = InviteInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateInviteSchema = InviteSelectSchema.partial().pick({
	email: true,
	token: true,
	invitedById: true,
	expiresAt: true,
	status: true,
});

export const AcceptInviteSchema = z.object({
	token: z.string().uuid(),
	name: z.string().min(1),
	email: z.string().email(),
	phone: z.string().optional(),
	password: z.string().min(6),
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
