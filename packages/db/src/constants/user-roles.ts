export const USER_ROLES = {
	TENANT: "tenant",
	OWNER: "owner",
	ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_VALUES = Object.values(USER_ROLES) as [
	UserRole,
	...UserRole[],
];

// ── Tenant identity verification state machine ──────────────────
export const TENANT_VERIFICATION_STATUS = {
	UNVERIFIED: "unverified",
	PENDING: "pending",
	VERIFIED: "verified",
	REJECTED: "rejected",
} as const;

export type TenantVerificationStatus =
	(typeof TENANT_VERIFICATION_STATUS)[keyof typeof TENANT_VERIFICATION_STATUS];

export const TENANT_VERIFICATION_STATUS_VALUES = Object.values(
	TENANT_VERIFICATION_STATUS,
) as [TenantVerificationStatus, ...TenantVerificationStatus[]];

// For document update request lifecycle (a specific change request)
export const DOCUMENT_REQUEST_STATUS = {
	PENDING: "pending", // submitted, awaiting owner review
	APPROVED: "approved", // owner approved, window is open
	REJECTED: "rejected", // owner said no
	COMPLETED: "completed", // tenant made the update
	EXPIRED: "expired", // approved but window lapsed
} as const;

export type DocumentRequestStatus =
	(typeof DOCUMENT_REQUEST_STATUS)[keyof typeof DOCUMENT_REQUEST_STATUS];

export const DOCUMENT_REQUEST_STATUS_VALUES = Object.values(
	DOCUMENT_REQUEST_STATUS,
) as [DocumentRequestStatus, ...DocumentRequestStatus[]];

// ── Which document field can be unlocked ────────────────────────
// Separate concern: what field is being requested to change?
export const DOCUMENT_FIELDS = {
	UID: "uid_number",
	PAN: "pan_number",
	PROFILE_IMAGE: "profile_image",
} as const;

export type DocumentField =
	(typeof DOCUMENT_FIELDS)[keyof typeof DOCUMENT_FIELDS];

export const DOCUMENT_FIELDS_VALUES = Object.values(DOCUMENT_FIELDS) as [
	DocumentField,
	...DocumentField[],
];
