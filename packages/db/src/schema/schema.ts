import {
	INVITE_DELIVERY_ERROR_CODE_VALUES,
	INVITE_DELIVERY_STATUS_VALUES,
	INVITE_DELIVERY_STATUSES,
	INVITE_STATUS_VALUES,
	INVITE_STATUSES,
	LEASE_AGREEMENT_ARRANGEMENT_VALUES,
	LEASE_CATEGORY_VALUES,
	LEASE_STATUS_VALUES,
	PAYMENT_TYPE_VALUES,
	PROPERTY_TYPES_VALUES,
	TENANT_ONBOARDING_MODE_VALUES,
	TENANT_ONBOARDING_MODES,
	UNIT_FURNISHING_VALUES,
	UNIT_STATUS_VALUES,
	UNIT_TYPES_VALUES,
	UTILITY_TYPE_VALUES,
} from "@rently/db/constants/rent-constants";
import {
	SCHEDULED_EMAIL_DELIVERY_STATUS_VALUES,
	SCHEDULED_EMAIL_TYPE_VALUES,
} from "@rently/db/constants/scheduled-email-constants";
import {
	ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES,
	DOCUMENT_CONSENT_SOURCE_VALUES,
	DOCUMENT_UPDATE_REQUEST_STATUS_VALUES,
	SUBMISSION_SOURCE_VALUES,
	TENANT_DOCUMENT_STATUS_VALUES,
	TENANT_DOCUMENT_TYPE_VALUES,
} from "@rently/db/constants/tenant-document-constants";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	check,
	integer,
	numeric,
	pgTable,
	real,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { NOTIFICATION_TYPE_VALUES } from "../constants/notification-constants";
import {
	APPLIED_AS_VALUES,
	CREDIT_TYPE_VALUES,
	CREDIT_TYPES,
	PAYMENT_METHOD_VALUES,
} from "../constants/payment-constants";
import {
	DOCUMENT_FIELDS_VALUES,
	DOCUMENT_REQUEST_STATUS_VALUES,
	TENANT_VERIFICATION_STATUS_VALUES,
} from "../constants/user-roles";
import { auditColumns, idColumn, softDeleteColumn } from "../utils/columns";
import { generatedId } from "../utils/id";
import { user } from "./auth";

// ******* Owner Related Table like Properties, Units, Leases ***

export const properties = pgTable("properties", {
	...idColumn(),
	ownerId: uuid("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	name: text("name").notNull(),
	address: text("address").notNull(),
	type: text("type", { enum: PROPERTY_TYPES_VALUES }).notNull(),
	yearBuilt: numeric("year_built"),
	totalArea: numeric("total_area"),
	floors: numeric("floors"),
	description: text("description"),
	...auditColumns(),
	...softDeleteColumn(),
});

export const units = pgTable(
	"units",
	{
		...idColumn(),
		propertyId: uuid("property_id")
			.notNull()
			.references(() => properties.id, { onDelete: "restrict" }),
		unitNumber: text("unit_number").notNull(),
		type: text("type", { enum: UNIT_TYPES_VALUES }).notNull(),
		area: real("area"),
		baseRent: integer("base_rent").notNull(), // Paisa or cents
		furnishing: text("furnishing", { enum: UNIT_FURNISHING_VALUES }).default(
			"unfurnished",
		),
		description: text("description"),
		status: text("status", { enum: UNIT_STATUS_VALUES }).notNull(),
		...auditColumns(),
		...softDeleteColumn(),
	},
	(table) => [check("units_base_rent_check", sql`${table.baseRent} > 0`)],
);

export const leaseAgreements = pgTable(
	"lease_agreements",
	{
		...idColumn(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		propertyId: uuid("property_id")
			.notNull()
			.references(() => properties.id, { onDelete: "restrict" }),
		arrangementType: text("arrangement_type", {
			enum: LEASE_AGREEMENT_ARRANGEMENT_VALUES,
		}).notNull(),
		category: text("category", {
			enum: LEASE_CATEGORY_VALUES,
		}).notNull(),
		rentDueDate: integer("rent_due_date"),
		startDate: timestamp("start_date").notNull(),
		endDate: timestamp("end_date"),
		notice: integer("notice"),
		description: text("description"),
		...auditColumns(),
	},
	(table) => [
		check(
			"lease_agreements_due_day_check",
			sql`${table.rentDueDate} is null or (${table.rentDueDate} >= 1 and ${table.rentDueDate} <= 31)`,
		),
		check(
			"lease_agreements_date_order_check",
			sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
		),
	],
);

export const leases = pgTable(
	"leases",
	{
		...idColumn(),
		unitId: uuid("unit_id")
			.notNull()
			.references(() => units.id, { onDelete: "restrict" }),
		tenantId: uuid("tenant_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		startDate: timestamp("start_date").notNull(),
		endDate: timestamp("end_date"),
		rent: integer("rent").notNull(),
		deposit: integer("deposit"),
		status: text("status", {
			enum: LEASE_STATUS_VALUES,
		}).notNull(),
		notice: integer("notice"),
		rentDueDate: integer("rent_due_date"),
		description: text("description"),
		referenceId: uuid("reference_id").references(() => user.id),
		agreementId: uuid("agreement_id").references(() => leaseAgreements.id),
		...auditColumns(),
	},
	(table) => [
		check("leases_rent_check", sql`${table.rent} > 0`),
		check(
			"leases_deposit_check",
			sql`${table.deposit} is null or ${table.deposit} >= 0`,
		),
		check(
			"leases_due_day_check",
			sql`${table.rentDueDate} is null or (${table.rentDueDate} >= 1 and ${table.rentDueDate} <= 31)`,
		),
		check(
			"leases_date_order_check",
			sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
		),
		uniqueIndex("leases_one_active_per_unit_key")
			.on(table.unitId)
			.where(sql`${table.status} = 'active'`),
	],
);

// ═══════════════════════════════════════════════════════════
// ****** Accounting **************
// ═══════════════════════════════════════════════════════════

export const utilities = pgTable(
	"utilities",
	{
		...idColumn(),
		batchId: uuid("batch_id").$defaultFn(() => generatedId()),
		leaseId: uuid("lease_id")
			.notNull()
			.references(() => leases.id, { onDelete: "restrict" }),
		utilityType: text("utility_type", {
			enum: UTILITY_TYPE_VALUES,
		}).notNull(),
		previousReadingDate: timestamp("previous_reading_date"),
		currentReadingDate: timestamp("reading_date").notNull(),
		previousReading: real("previous_reading").notNull(),
		currentReading: real("current_reading").notNull(),
		unitsUsed: real("units_used"),
		ratePerUnit: real("rate_per_unit"),
		fixedCharge: integer("fixed_charge"),
		totalAmount: integer("total_amount").notNull(),
		description: text("description"),
		isPaid: boolean("is_paid").notNull().default(false),
		...auditColumns(),
	},
	(table) => [
		check(
			"utilities_fixed_charge_check",
			sql`${table.fixedCharge} is null or ${table.fixedCharge} >= 0`,
		),
		check(
			"utilities_rate_check",
			sql`${table.ratePerUnit} is null or ${table.ratePerUnit} >= 0`,
		),
		check(
			"utilities_readings_check",
			sql`${table.previousReading} >= 0 and ${table.currentReading} >= 0 and ${table.currentReading} >= ${table.previousReading}`,
		),
		check(
			"utilities_period_order_check",
			sql`${table.previousReadingDate} is null or ${table.previousReadingDate} <= ${table.currentReadingDate}`,
		),
	],
);

export const paymentGroups = pgTable("payment_groups", {
	...idColumn(),
	agreementId: uuid("agreement_id")
		.notNull()
		.references(() => leaseAgreements.id),
	paymentDate: timestamp("payment_date").notNull(),
	paymentMethods: text("payment_method", {
		enum: PAYMENT_METHOD_VALUES,
	}),
	referenceNumber: text("reference_number"),
	description: text("description"),
	reversesPaymentGroupId: uuid("reverses_payment_group_id").references(
		(): AnyPgColumn => paymentGroups.id,
	),
	...auditColumns(),
});

export const payments = pgTable(
	"payments",
	{
		...idColumn(),
		leaseId: uuid("lease_id")
			.notNull()
			.references(() => leases.id, { onDelete: "restrict" }),
		amount: integer("amount").notNull(),
		paymentDate: timestamp("payment_date").notNull(),
		paymentMethods: text("payment_method", {
			enum: PAYMENT_METHOD_VALUES,
		}),
		referenceNumber: text("reference_number"),
		type: text("type", {
			enum: PAYMENT_TYPE_VALUES,
		}).notNull(),
		description: text("description"),
		utilityId: uuid("utility_id").references(() => utilities.id),
		paymentGroupId: uuid("payment_group_id").references(() => paymentGroups.id),
		// Machine-enforced link to the voided original. Nullable: only reversal
		// rows carry one (B04 builds the one-reversal-per-original invariant on
		// this column). referenceNumber is retained for display/audit.
		reversesPaymentId: uuid("reverses_payment_id").references(
			(): AnyPgColumn => payments.id,
		),
		// Client-supplied idempotency key. Nullable: legacy writers and backfilled
		// rows have none. A partial unique index makes a retried insert self-reject
		// so Neon HTTP (no FOR UPDATE) cannot double-settle a lease/utility.
		idempotencyKey: uuid("idempotency_key"),
		...auditColumns(),
	},
	(table) => [
		check(
			"payments_type_utility_check",
			// Utility payments name their bill; rent/deposit/other never do.
			// Reversals preserve the original's utility link (linked via
			// reversesPaymentId), so they stay exempt here.
			sql`(${table.type} = 'utility' and ${table.utilityId} is not null) or (${table.type} in ('rent', 'deposit', 'other') and ${table.utilityId} is null) or ${table.type} = 'reversal'`,
		),
		check(
			"payments_reversal_link_check",
			sql`(${table.type} = 'reversal' and ${table.reversesPaymentId} is not null) or (${table.type} != 'reversal' and ${table.reversesPaymentId} is null)`,
		),
		uniqueIndex("payments_lease_idempotency_key")
			.on(table.leaseId, table.idempotencyKey)
			.where(sql`${table.idempotencyKey} is not null`),
	],
);

export const billCredits = pgTable(
	"bill_credits",
	{
		...idColumn(),
		leaseId: uuid("lease_id")
			.notNull()
			.references(() => leases.id, {
				onDelete: "restrict",
			}),
		utilityId: uuid("utility_id").references(() => utilities.id, {
			onDelete: "restrict",
		}),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		type: text("type", {
			enum: CREDIT_TYPE_VALUES,
		})
			.notNull()
			.default(CREDIT_TYPES.WRITE_OFF),
		amount: integer("amount").notNull(),
		reason: text("reason").notNull(),
		creditNoteNo: text("credit_note_no").notNull().unique(),
		appliedAs: text("applied_as", { enum: APPLIED_AS_VALUES })
			.notNull()
			.default("adjust"),
		reversesCreditId: uuid("reverses_credit_id").references(
			(): AnyPgColumn => billCredits.id,
		),
		reversedAt: timestamp("reversed_at"),
		// Client-supplied idempotency key (partial unique index guards Neon races).
		idempotencyKey: uuid("idempotency_key"),
		createdBy: uuid("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		...auditColumns(),
	},
	(t) => [
		check("bill_credits_amount_check", sql`${t.amount} != 0`),
		check(
			"bill_credits_reason_length_check",
			sql`char_length(${t.reason}) >= 10`,
		),
		uniqueIndex("bill_credits_lease_idempotency_key")
			.on(t.leaseId, t.idempotencyKey)
			.where(sql`${t.idempotencyKey} is not null`),
	],
);

// ═══════════════════════════════════════════════════════════
// TENANCY: Invites, Profiles
// Order matters — tenantProfiles before documentUpdateRequests
// ═══════════════════════════════════════════════════════════

export const tenantInvites = pgTable("tenant_invites", {
	...idColumn(),
	// Owner controlled invitation identity
	name: text("name").notNull(),
	email: text("email").notNull(), // to invite
	notes: text("notes"), // Owner-private, never shown to tenant
	onboardingMode: text("onboarding_mode", {
		enum: TENANT_ONBOARDING_MODE_VALUES,
	})
		.default(TENANT_ONBOARDING_MODES.TENANT_COMPLETED)
		.notNull(),
	//owner prepared profile draft
	phone: text("phone"),
	address: text("address"),
	emergencyContact: text("emergency_contact"),
	emergencyContactName: text("emergency_contact_name"),
	emergencyContactLocation: text("emergency_contact_location"),
	//Invitation lifecycle
	token: text("token").unique().notNull(), // secret to validate user
	expiresAt: timestamp("expires_at"),
	invitedById: uuid("invited_by")
		.notNull()
		.references(() => user.id),
	status: text("status", {
		enum: INVITE_STATUS_VALUES,
	})
		.default(INVITE_STATUSES.PENDING)
		.notNull(),
	// Latest email delivery result, independent of invitation lifecycle
	deliveryStatus: text("delivery_status", {
		enum: INVITE_DELIVERY_STATUS_VALUES,
	})
		.default(INVITE_DELIVERY_STATUSES.NOT_ATTEMPTED)
		.notNull(),
	lastSentAt: timestamp("last_sent_at"),
	deliveryErrorCode: text("delivery_error_code", {
		enum: INVITE_DELIVERY_ERROR_CODE_VALUES,
	}),
	// Tenant consent evidence, populated only during acceptance
	termsAcceptedAt: timestamp("terms_accepted_at"),
	termsVersion: text("terms_version"),
	privacyAcknowledgedAt: timestamp("privacy_acknowledged_at"),
	privacyVersion: text("privacy_version"),
	...auditColumns(),
	...softDeleteColumn(),
});

export const tenantProfiles = pgTable("tenant_profiles", {
	...idColumn(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	// Business rule enforcedin API layer, not db layer
	// Immutable after first set - can change only after approval
	// Kept temporarily for rollback compatibility. New code must not read/write it.
	uidNumber: text("uid_number"),
	aadhaarLastFour: text("aadhaar_last_four"),
	panNumber: text("pan_number").unique(),
	profileImage: text("image"),
	// Contact
	phone: text("phone"),
	email: text("email"),
	address: text("address"),
	emergencyContact: text("emergency_contact"),
	emergencyContactName: text("emergency_contact_name"),
	emergencyContactLocation: text("emergency_contact_location"),

	// Identity Verfication tracking (owner reviews)
	verificationStatus: text("verification_status", {
		enum: TENANT_VERIFICATION_STATUS_VALUES,
	})
		.default("unverified")
		.notNull(),
	verificationNotes: text("verification_notes"), // Owner private
	verifiedById: uuid("verified_by").references(() => user.id),
	verifiedAt: timestamp("verified_at"),

	// Audit
	invitedId: uuid("invite_id").references(() => tenantInvites.id),
	createdById: uuid("created_by").references(() => user.id),
	...auditColumns(),
	...softDeleteColumn(),
});

// Legacy field-based workflow. It is renamed to legacy_document_update_requests
// by the M2 contract migration; do not add new callers for this table.
export const documentUpdateRequests = pgTable("document_update_requests", {
	...idColumn(),
	tenantProfileId: uuid("tenant_profile_id")
		.notNull()
		.references(() => tenantProfiles.id, { onDelete: "restrict" }),
	ownerId: uuid("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	// FK is added by the contract migration to avoid a declaration cycle.
	sourceDocumentId: uuid("source_document_id").notNull(),
	requestedById: uuid("requested_by_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	reason: text("reason").notNull(),
	status: text("status", {
		enum: DOCUMENT_UPDATE_REQUEST_STATUS_VALUES,
	})
		.notNull()
		.default("pending"),
	reviewedById: uuid("reviewed_by_id").references(() => user.id),
	reviewedAt: timestamp("reviewed_at"),
	ownerNote: text("owner_note"),
	approvedExpiresAt: timestamp("approved_expires_at"),
	replacementDocumentId: uuid("replacement_document_id"),
	submittedAt: timestamp("submitted_at"),
	completedAt: timestamp("completed_at"),
	rejectedAt: timestamp("rejected_at"),
	expiredAt: timestamp("expired_at"),
	consentVersion: text("consent_version").notNull(),
	consentedAt: timestamp("consented_at").notNull(),
	...auditColumns(),
});

export const tenantDocuments = pgTable(
	"tenant_documents",
	{
		...idColumn(),
		tenantProfileId: uuid("tenant_profile_id")
			.notNull()
			.references(() => tenantProfiles.id, { onDelete: "restrict" }),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		documentType: text("document_type", {
			enum: TENANT_DOCUMENT_TYPE_VALUES,
		}).notNull(),
		version: integer("version").notNull(),
		supersedesDocumentId: uuid("supersedes_document_id").references(
			(): AnyPgColumn => tenantDocuments.id,
		),
		// FK is added by the contract migration to avoid a declaration cycle.
		updateRequestId: uuid("update_request_id"),
		status: text("status", {
			enum: TENANT_DOCUMENT_STATUS_VALUES,
		}).notNull(),
		storageKey: text("storage_key").notNull().unique(),
		contentType: text("content_type", {
			enum: ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES,
		}).notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		etag: text("etag"),
		identifierHint: text("identifier_hint"),
		maskedAadhaarConfirmed: boolean("masked_aadhaar_confirmed"),
		submissionSource: text("submission_source", {
			enum: SUBMISSION_SOURCE_VALUES,
		}).notNull(),
		submittedById: uuid("submitted_by_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		submittedAt: timestamp("submitted_at"),
		uploadExpiresAt: timestamp("upload_expires_at").notNull(),
		consentSource: text("consent_source", {
			enum: DOCUMENT_CONSENT_SOURCE_VALUES,
		}),
		consentVersion: text("consent_version"),
		consentedById: uuid("consented_by_id").references(() => user.id),
		consentedAt: timestamp("consented_at"),
		consentExpiresAt: timestamp("consent_expires_at"),
		reviewedById: uuid("reviewed_by_id").references(() => user.id),
		reviewedAt: timestamp("reviewed_at"),
		reviewNote: text("review_note"),
		purgeAfter: timestamp("purge_after"),
		purgedAt: timestamp("purged_at"),
		purgeAttempts: integer("purge_attempts").notNull().default(0),
		lastPurgeErrorCode: text("last_purge_error_code"),
		...auditColumns(),
	},
	(table) => [
		unique("tenant_documents_tenant_type_version_key").on(
			table.tenantProfileId,
			table.documentType,
			table.version,
		),
		check("tenant_documents_version_check", sql`${table.version} > 0`),
		check(
			"tenant_documents_size_bytes_check",
			sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 10485760`,
		),
		uniqueIndex("tenant_documents_one_reviewed_per_type_key")
			.on(table.tenantProfileId, table.documentType)
			.where(sql`${table.status} = 'owner_reviewed'`),
		uniqueIndex("tenant_documents_one_replacement_per_request_key")
			.on(table.updateRequestId)
			.where(sql`${table.updateRequestId} IS NOT NULL`),
	],
);

/*
	The declaration below is intentionally retained only as a migration aid in
		the source history. The active table definition is above.
*/
export const legacyDocumentUpdateRequests = pgTable(
	"legacy_document_update_requests",
	{
		...idColumn(),
		tenantProfileId: uuid("tenant_profile_id")
			.notNull()
			.references(() => tenantProfiles.id, { onDelete: "restrict" }), // ← forward ref OK in .references()
		requestedById: uuid("requested_by_id")
			.notNull()
			.references(() => user.id), // who requested the change (owner or tenant)
		reason: text("reason").notNull(),
		fieldToUpdate: text("field_to_update", {
			enum: DOCUMENT_FIELDS_VALUES,
		}).notNull(),
		status: text("status", {
			enum: DOCUMENT_REQUEST_STATUS_VALUES,
		})
			.default("pending")
			.notNull(),
		// Who reviewed + when
		reviewedById: uuid("reviewed_by_id").references(() => user.id),
		reviewedAt: timestamp("reviewed_at"),
		ownerNotes: text("owner_notes"),
		// The Aproval window - when does the unlock expire
		approvedExpiresAt: timestamp("approved_expires_at"),
		completedAt: timestamp("completed_at"),
		newValueSubmitted: text("new_value"),
		...auditColumns(),
		...softDeleteColumn(),
	},
);

export const ownerProfiles = pgTable(
	"owner_profiles",
	{
		...idColumn(),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		companyName: text("company_name").notNull(),
		address: text("address"),
		gstNumber: text("gst_number"),
		gstEnabled: boolean("gst_enabled").notNull().default(false),
		gstRateRent: integer("gst_rate_rent").notNull().default(0),
		gstRateMaintenance: integer("gst_rate_maintenance").notNull().default(0),
		upiId: text("upi_id"),
		...auditColumns(),
		...softDeleteColumn(),
	},
	(table) => [
		check(
			"owner_profiles_gst_rate_rent_check",
			sql`${table.gstRateRent} IN (0,5,12,18)`,
		),
		check(
			"owner_profiles_gst_rate_maintenance_check",
			sql`${table.gstRateMaintenance} IN (0,5,12,18)`,
		),
	],
);

export const referrers = pgTable("referrers", {
	...idColumn(),
	referredUserId: uuid("referred_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	note: text("note"),
	...auditColumns(),
	...softDeleteColumn(),
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

export const notifications = pgTable("notifications", {
	...idColumn(),
	// userId is the OWNER who receives this notification — never the tenant
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	type: text("type", {
		enum: NOTIFICATION_TYPE_VALUES,
	}).notNull(),
	title: text("title").notNull(),
	message: text("message").notNull(),
	isRead: boolean("is_read").default(false).notNull(),
	// Optional link to the entity that triggered this notification
	// WHY nullable: lease_expiring_soon links to a lease, others may not
	entityId: uuid("entity_id"),
	entityType: text("entity_type"), // "lease" | "utility" | "invite"
	...auditColumns(),
	// WHY no softDeleteColumn: notifications are marked as read, not deleted.
	// Keeping them in the table supports future "notification history" views.
});

export const notificationPreferences = pgTable(
	"notification_preferences",
	{
		...idColumn(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" })
			.unique(),
		paymentReceived: boolean("payment_received").notNull().default(true),
		utilityBillGenerated: boolean("utility_bill_generated")
			.notNull()
			.default(false),
		leaseExpiryAlert: boolean("lease_expiry_alert").notNull().default(true),
		rentDueReminder: boolean("rent_due_reminder").notNull().default(true),
		overdueAlert: boolean("overdue_alert").notNull().default(true),
		rentDueLeadDays: integer("rent_due_lead_days").notNull().default(3),
		overdueGraceDays: integer("overdue_grace_days").notNull().default(2),
		...auditColumns(),
	},
	(table) => [
		check(
			"notification_preferences_rent_due_lead_days_check",
			sql`${table.rentDueLeadDays} >= 0 AND ${table.rentDueLeadDays} <= 14`,
		),
		check(
			"notification_preferences_overdue_grace_days_check",
			sql`${table.overdueGraceDays} >= 1 AND ${table.overdueGraceDays} <= 31`,
		),
	],
);

export const scheduledEmailDeliveries = pgTable(
	"scheduled_email_deliveries",
	{
		...idColumn(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		leaseId: uuid("lease_id")
			.notNull()
			.references(() => leases.id, { onDelete: "cascade" }),
		type: text("type", { enum: SCHEDULED_EMAIL_TYPE_VALUES }).notNull(),
		periodKey: text("period_key").notNull(),
		thresholdDays: integer("threshold_days").notNull(),
		status: text("status", {
			enum: SCHEDULED_EMAIL_DELIVERY_STATUS_VALUES,
		})
			.notNull()
			.default("claimed"),
		attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
		sentAt: timestamp("sent_at"),
		...auditColumns(),
	},
	(table) => [
		unique("scheduled_email_deliveries_dedupe_key").on(
			table.ownerId,
			table.leaseId,
			table.type,
			table.periodKey,
			table.thresholdDays,
		),
	],
);

export const rentReminderSuppressions = pgTable(
	"rent_reminder_suppressions",
	{
		...idColumn(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		leaseId: uuid("lease_id")
			.notNull()
			.references(() => leases.id, { onDelete: "cascade" }),
		periodKey: text("period_key").notNull(),
		...auditColumns(),
	},
	(table) => [
		unique("rent_reminder_suppressions_dedupe_key").on(
			table.ownerId,
			table.leaseId,
			table.periodKey,
		),
	],
);
