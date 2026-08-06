import { TENANT_ONBOARDING_MODES } from "@rently/db/constants/rent-constants";
import { referrers, tenantInvites } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";
import { TenantProfileDraftSchema } from "./tenant";

// ******** Invite **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime from Drizzle
export const InviteSelectSchema = createSelectSchema(tenantInvites);
export const InviteInsertSchema = createInsertSchema(tenantInvites);

export const ReferrerSelectSchema = createSelectSchema(referrers);
export const ReferrerInsertSchema = createInsertSchema(referrers);

// ── Layer 2: API input schemas
// Business Logic Schemas (API Consumers)
const InviteIdentitySchema = z.object({
	name: z.string().trim().min(1, "Tenant name is required"),
	email: z.email("Invalid email"),
	expiresAt: z.date().optional(),
	notes: z.string().trim().optional(),
});

// The normal “Invite Tenant” path. The tenant completes their own profile.
export const CreateInviteSchema = InviteIdentitySchema;

// The “Add Manually” path. It creates an owner-prepared invitation,
// never a Better Auth account.
export const CreateOwnerPreparedInviteSchema = InviteIdentitySchema.extend({
	onboardingMode: z.literal(TENANT_ONBOARDING_MODES.OWNER_PREPARED),
}).extend(TenantProfileDraftSchema.shape);

const TenantCompletedProfileSchema = TenantProfileDraftSchema;

const TenantSensitiveIdentitySchema = z.object({
	uidNumber: z.string().trim().min(1).optional(),
	panNumber: z.string().trim().min(1).optional(),
});

export const UpdateInviteSchema = createUpdateSchema(tenantInvites).pick({
	status: true,
});

export const AcceptInviteSchema = z
	.object({
		token: z.uuid("Invalid invite link"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/[A-Z]/, "Must contain uppercase")
			.regex(/[a-z]/, "Must contain lowercase")
			.regex(/[0-9]/, "Must contain a number"),
		termsAccepted: z.literal(true, {
			error: "You must accept the Terms of Service",
		}),
		privacyAcknowledged: z.literal(true, {
			error: "You must acknowledge the Privacy Policy",
		}),
	})
	.extend(TenantSensitiveIdentitySchema.shape)
	.extend(TenantCompletedProfileSchema.shape);

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
export const InvitePublicSchema = InviteSelectSchema.pick({
	id: true,
	name: true,
	email: true,
	onboardingMode: true,
	phone: true,
	address: true,
	emergencyContact: true,
	emergencyContactName: true,
	emergencyContactLocation: true,
	status: true,
	expiresAt: true,
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
