import {
	ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES,
	TENANT_DOCUMENT_TYPE_VALUES,
} from "@rently/db/constants/tenant-document-constants";
import z from "zod";

export const TenantDocumentTypeSchema = z.enum(TENANT_DOCUMENT_TYPE_VALUES);
export const AllowedTenantDocumentContentTypeSchema = z.enum(
	ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES,
);

export const TenantDocumentCapabilitiesSchema = z.object({
	maxBytes: z.number().int(),
	allowedContentTypes: z.array(AllowedTenantDocumentContentTypeSchema),
	uploadUrlTtlSeconds: z.number().int(),
	downloadUrlTtlSeconds: z.number().int(),
	documentTypes: z.array(
		z.object({
			type: TenantDocumentTypeSchema,
			enabled: z.boolean(),
			disabledReason: z.string().nullable(),
		}),
	),
});

export const TenantDocumentUpdateRequestSchema = z.object({
	id: z.string(),
	sourceDocumentId: z.string(),
	reason: z.string(),
	status: z.enum([
		"pending",
		"approved",
		"submitted",
		"completed",
		"rejected",
		"expired",
	]),
	ownerNote: z.string().nullable(),
	approvedExpiresAt: z.date().nullable(),
	submittedAt: z.date().nullable(),
	consentedAt: z.date(),
});

export const TenantDocumentSummarySchema = z.object({
	id: z.string(),
	documentType: TenantDocumentTypeSchema,
	version: z.number().int(),
	status: z.enum([
		"upload_pending",
		"awaiting_tenant_consent",
		"pending_review",
		"owner_reviewed",
		"rejected",
		"superseded",
		"expired",
	]),
	contentType: AllowedTenantDocumentContentTypeSchema,
	sizeBytes: z.number().int(),
	identifierHint: z.string().nullable(),
	submissionSource: z.enum(["tenant", "owner"]),
	submittedAt: z.date().nullable(),
	consentExpiresAt: z.date().nullable(),
	reviewedAt: z.date().nullable(),
	reviewNote: z.string().nullable(),
	purgeAfter: z.date().nullable(),
	purgedAt: z.date().nullable(),
	updateRequest: TenantDocumentUpdateRequestSchema.nullable(),
});

export const TenantDocumentListSchema = z.object({
	documents: z.array(TenantDocumentSummarySchema),
	capabilities: TenantDocumentCapabilitiesSchema,
});

export type TenantDocumentTypeInput = z.infer<typeof TenantDocumentTypeSchema>;
export type AllowedTenantDocumentContentTypeInput = z.infer<
	typeof AllowedTenantDocumentContentTypeSchema
>;
