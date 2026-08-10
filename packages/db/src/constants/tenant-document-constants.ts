export const TENANT_DOCUMENT_TYPES = {
	AADHAAR: "aadhaar",
	PAN: "pan",
	PASSPORT_PHOTO: "passport_photo",
	POLICE_VERIFICATION: "police_verification",
	BANK_PASSBOOK: "bank_passbook",
	VOTER_ID: "voter_id",
} as const;

export type TenantDocumentType =
	(typeof TENANT_DOCUMENT_TYPES)[keyof typeof TENANT_DOCUMENT_TYPES];

export const TENANT_DOCUMENT_TYPE_VALUES = Object.values(
	TENANT_DOCUMENT_TYPES,
) as [TenantDocumentType, ...TenantDocumentType[]];

export const TENANT_DOCUMENT_STATUSES = {
	UPLOAD_PENDING: "upload_pending",
	AWAITING_TENANT_CONSENT: "awaiting_tenant_consent",
	PENDING_REVIEW: "pending_review",
	OWNER_REVIEWED: "owner_reviewed",
	REJECTED: "rejected",
	SUPERSEDED: "superseded",
	EXPIRED: "expired",
} as const;

export type TenantDocumentStatus =
	(typeof TENANT_DOCUMENT_STATUSES)[keyof typeof TENANT_DOCUMENT_STATUSES];

export const TENANT_DOCUMENT_STATUS_VALUES = Object.values(
	TENANT_DOCUMENT_STATUSES,
) as [TenantDocumentStatus, ...TenantDocumentStatus[]];

export const SUBMISSION_SOURCES = {
	TENANT: "tenant",
	OWNER: "owner",
} as const;

export type SubmissionSource =
	(typeof SUBMISSION_SOURCES)[keyof typeof SUBMISSION_SOURCES];

export const SUBMISSION_SOURCE_VALUES = Object.values(SUBMISSION_SOURCES) as [
	SubmissionSource,
	...SubmissionSource[],
];

export const DOCUMENT_CONSENT_SOURCES = {
	TENANT_DIRECT_UPLOAD: "tenant_direct_upload",
	TENANT_CONFIRMED_OWNER_UPLOAD: "tenant_confirmed_owner_upload",
	TENANT_UPDATE_REQUEST: "tenant_update_request",
} as const;

export type DocumentConsentSource =
	(typeof DOCUMENT_CONSENT_SOURCES)[keyof typeof DOCUMENT_CONSENT_SOURCES];

export const DOCUMENT_CONSENT_SOURCE_VALUES = Object.values(
	DOCUMENT_CONSENT_SOURCES,
) as [DocumentConsentSource, ...DocumentConsentSource[]];

export const DOCUMENT_UPDATE_REQUEST_STATUSES = {
	PENDING: "pending",
	APPROVED: "approved",
	SUBMITTED: "submitted",
	COMPLETED: "completed",
	REJECTED: "rejected",
	EXPIRED: "expired",
} as const;

export type DocumentUpdateRequestStatus =
	(typeof DOCUMENT_UPDATE_REQUEST_STATUSES)[keyof typeof DOCUMENT_UPDATE_REQUEST_STATUSES];

export const DOCUMENT_UPDATE_REQUEST_STATUS_VALUES = Object.values(
	DOCUMENT_UPDATE_REQUEST_STATUSES,
) as [DocumentUpdateRequestStatus, ...DocumentUpdateRequestStatus[]];

export const ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
] as const;

export type AllowedTenantDocumentContentType =
	(typeof ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES)[number];

export const TENANT_DOCUMENT_MAX_BYTES = 10_485_760;
export const TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS = 600;
export const TENANT_DOCUMENT_UPLOAD_SESSION_SECONDS = 30 * 60;
export const TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS = 60;
export const TENANT_DOCUMENT_CONSENT_SECONDS = 7 * 24 * 60 * 60;
export const TENANT_DOCUMENT_UPDATE_WINDOW_SECONDS = 48 * 60 * 60;
export const TENANT_DOCUMENT_RETENTION_SECONDS = 30 * 24 * 60 * 60;
export const TENANT_DOCUMENT_CLEANUP_BATCH_SIZE = 20;

export const KEYHQ_DOCUMENT_CONSENT_VERSION = "2026-08-01";

export const TENANT_DOCUMENT_PURGE_ERROR_CODES = {
	STORAGE_UNAVAILABLE: "storage_unavailable",
	STORAGE_DELETE_FAILED: "storage_delete_failed",
	UNKNOWN: "unknown",
} as const;

export type TenantDocumentPurgeErrorCode =
	(typeof TENANT_DOCUMENT_PURGE_ERROR_CODES)[keyof typeof TENANT_DOCUMENT_PURGE_ERROR_CODES];
