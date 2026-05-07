import { INVITE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import z from "zod";

export const TenantInviteSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	token: z.uuid(),
	invitedById: z.uuid(),
	expiresAt: z.date(),
	status: z.enum(INVITE_STATUS_VALUES).default("pending"),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const CreateInviteSchema = TenantInviteSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateInviteSchema = TenantInviteSchema.partial().pick({
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
