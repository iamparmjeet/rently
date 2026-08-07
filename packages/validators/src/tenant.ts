import { INVITE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import {
	DOCUMENT_FIELDS_VALUES,
	TENANT_VERIFICATION_STATUS_VALUES,
} from "@rently/db/constants/user-roles";
import { tenantProfiles } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";
import { OverdueSummarySchema } from "./overdue";

// Zod Values from array
export const DocumentFieldSchema = z.enum(DOCUMENT_FIELDS_VALUES);
// Type Derived from zod (not from db layer directly)
export type DocumentFieldInput = z.infer<typeof DocumentFieldSchema>;

// ── Layer 1: DB-derived
// Derive Zod Schemas - for runtime
export const TenantProfileSelectSchema = createSelectSchema(tenantProfiles);
export const TenantProfileInsertSchema = createInsertSchema(tenantProfiles);

// ── Layer 2: API input schemas
// 2. List item — what owner sees in the tenants grid
//    Must match TenantCard's Tenant interface exactly
export const TenantProfileDraftSchema = z.object({
	phone: z.string().trim().optional(),
	address: z.string().trim().optional(),
	emergencyContact: z.string().trim().optional(),
	emergencyContactName: z.string().trim().optional(),
	emergencyContactLocation: z.string().trim().optional(),
});

export const CreateTenantSchema = z
	.object({
		name: z.string().trim().min(1, "Name is required"),
		email: z.email("Invalid email"),
		notes: z.string().trim().optional(),
		expiresAt: z.date().optional(),
	})
	.extend(TenantProfileDraftSchema.shape);

export const UpdateTenantVerificationSchema = z.object({
	tenantId: z.string().min(1),
	verificationStatus: z.enum(TENANT_VERIFICATION_STATUS_VALUES),
	verificationNotes: z.string().optional(),
});

export const UpdateTenantProfileSchema = createUpdateSchema(
	tenantProfiles,
).pick({
	phone: true,
	address: true,
	emergencyContact: true,
	emergencyContactLocation: true,
	emergencyContactName: true,
	// uidNumber: true,
	// panNumber: true,
});

export const RemoveTenantSchema = z.object({
	tenantId: z.string().min(1),
});

// ── Layer 3: API output schemas

export const TenantProfileDataSchema = z.object({
	address: z.string().nullable(),
	emergencyContact: z.string().nullable(),
	emergencyContactName: z.string().nullable(),
	emergencyContactLocation: z.string().nullable(),
	uidNumber: z.string().nullable(),
	panNumber: z.string().nullable(),
	verificationStatus: z.enum(TENANT_VERIFICATION_STATUS_VALUES),
});

export const TenantListItemSchema = z.object({
	id: z.string(),
	/** Present until the tenant accepts their invitation; used to resend it. */
	inviteId: z.string().nullable(),
	name: z.string(),
	email: z.email(),
	emailVerified: z.boolean(),
	phone: z.string().nullable(),
	avatarUrl: z.string().nullable(),
	status: z.enum(INVITE_STATUS_VALUES).default("pending"),
	createdAt: z.date(),
	updatedAt: z.date(),
	currentLease: z
		.object({
			id: z.string(),
			propertyName: z.string(),
			unitNumber: z.string(),
			rent: z.number(),
			endDate: z.string().nullable(), // string, not Date (JSON transport)
			overdue: OverdueSummarySchema.nullable(),
		})
		.nullable(),
});

// Detail view — richer, used by detail + edit pages
export const TenantDetailSchema = TenantListItemSchema.extend({
	profile: TenantProfileDataSchema.nullable(),
});

// Types — always derive from Zod, never write manually
export type TenantProfile = z.infer<typeof TenantProfileSelectSchema>;
export type TenantListItem = z.infer<typeof TenantListItemSchema>;
export type TenantDetail = z.infer<typeof TenantDetailSchema>;
export type TenantProfileData = z.infer<typeof TenantProfileDataSchema>;
export type UpdateTenantVerification = z.infer<
	typeof UpdateTenantVerificationSchema
>;
export type UpdateTenantProfile = z.infer<typeof UpdateTenantProfileSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type RemoveTenant = z.infer<typeof RemoveTenantSchema>;
