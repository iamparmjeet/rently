import { INVITE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { DOCUMENT_FIELDS_VALUES } from "@rently/db/constants/user-roles";
import { tenantProfiles } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// Zod Values from array
export const DocumentFieldSchema = z.enum(DOCUMENT_FIELDS_VALUES);
// Type Derived from zod (not from db layer directly)
export type DocumentFieldInput = z.infer<typeof DocumentFieldSchema>;

// Derive Zod Schemas - for runtime
export const TenantProfileSelectSchema = createSelectSchema(tenantProfiles);
export const TenantProfileInsertSchema = createInsertSchema(tenantProfiles);

// 2. List item — what owner sees in the tenants grid
//    Must match TenantCard's Tenant interface exactly

export const TenantListItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.email(),
	phone: z.string().nullable(),
	avatarUrl: z.string().nullable(),
	status: z.enum(INVITE_STATUS_VALUES).default("pending"),
	currentLease: z
		.object({
			id: z.string(),
			propertyName: z.string(),
			unitNumber: z.string(),
			rent: z.number(),
			endDate: z.string().nullable(), // string, not Date (JSON transport)
		})
		.nullable(),
});

// 3. Owner verifies a tenant's identity documents
export const UpdateTenantVerificationSchema = z.object({
	tenantId: z.string().min(1),
	verificationStatus: DocumentFieldSchema,
	verificationNotes: z.string().optional(),
});

// 4. Tenant updates their own profile : Initial setup (before verification)
// Tenant can set UID/PAN when first completing their profile
//    Limited fields — tenant cannot change email (that's auth layer)
//    Cannot change verificationStatus (only owner can)

export const UpdateTenantProfileSchema =
	TenantProfileInsertSchema.partial().pick({
		phone: true,
		address: true,
		emergencyContact: true,
		emergencyContactLocation: true,
		emergencyContactName: true,
		uidNumber: true,
		panNumber: true,
	});

// Types — always derive from Zod, never write manually
export type TenantProfile = z.infer<typeof TenantProfileSelectSchema>;
export type TenantListItem = z.infer<typeof TenantListItemSchema>;
export type UpdateTenantVerification = z.infer<
	typeof UpdateTenantVerificationSchema
>;
export type UpdateTenantProfile = z.infer<typeof UpdateTenantProfileSchema>;
