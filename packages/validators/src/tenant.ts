import { INVITE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { tenantProfiles } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";
import { OverdueSummarySchema } from "./overdue";

// Zod Values from array
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

export const UpdateTenantProfileSchema = createUpdateSchema(
	tenantProfiles,
).pick({
	phone: true,
	address: true,
	emergencyContact: true,
	emergencyContactLocation: true,
	emergencyContactName: true,
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
	aadhaarLastFour: z
		.string()
		.regex(/^\d{4}$/)
		.nullable(),
	panNumber: z.string().nullable(),
});

// One tenant may hold multiple active leases. Keep this summary small enough
// for tenant cards and detail headers; full lease fields still come from the
// lease endpoints when needed.
export const TenantLeaseSummarySchema = z.object({
	id: z.string(),
	propertyName: z.string(),
	unitNumber: z.string(),
	rent: z.number(),
	endDate: z.string().nullable(), // string, not Date (JSON transport)
	overdue: OverdueSummarySchema.nullable(),
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
	activeLeases: z.array(TenantLeaseSummarySchema),
	// Compatibility field for existing cards and edit flows. New multi-unit UI
	// should use activeLeases instead.
	currentLease: TenantLeaseSummarySchema.nullable(),
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
export type TenantLeaseSummary = z.infer<typeof TenantLeaseSummarySchema>;
export type UpdateTenantProfile = z.infer<typeof UpdateTenantProfileSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type RemoveTenant = z.infer<typeof RemoveTenantSchema>;
