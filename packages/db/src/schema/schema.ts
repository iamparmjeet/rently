import {
	INVITE_STATUS_VALUES,
	INVITE_STATUSES,
	LEASE_STATUS_VALUES,
	PAYMENT_TYPE_VALUES,
	PROPERTY_TYPES_VALUES,
	UNIT_STATUS_VALUES,
	UNIT_TYPES_VALUES,
	UTILITY_TYPE_VALUES,
} from "@rently/db/constants/rent-constants";
import {
	boolean,
	integer,
	pgTable,
	real,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { PAYMENT_METHOD_VALUES } from "../constants/payment-constants";
import {
	DOCUMENT_FIELDS_VALUES,
	DOCUMENT_REQUEST_STATUS_VALUES,
	TENANT_VERIFICATION_STATUS_VALUES,
} from "../constants/user-roles";
import { auditColumns, idColumn } from "../utils/columns";
import { user } from "./auth";

// ******* Owner Related Table like Properties, Units, Leases ***

export const properties = pgTable("properties", {
	...idColumn(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	address: text("address").notNull(),
	type: text("type", { enum: PROPERTY_TYPES_VALUES }).notNull(),
	...auditColumns(),
});

export const units = pgTable("units", {
	...idColumn(),
	propertyId: text("property_id")
		.notNull()
		.references(() => properties.id, { onDelete: "cascade" }),
	unitNumber: text("unit_number").notNull(),
	type: text("type", { enum: UNIT_TYPES_VALUES }).notNull(),
	area: real("area"),
	baseRent: integer("base_rent").notNull(), // Paisa or cents
	description: text("description"),
	status: text("status", { enum: UNIT_STATUS_VALUES }).notNull(),
	...auditColumns(),
});

export const leases = pgTable("leases", {
	...idColumn(),
	unitId: text("unit_id")
		.notNull()
		.references(() => units.id, { onDelete: "cascade" }),
	tenantId: text("tenant_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	startDate: timestamp("start_date").notNull(),
	endDate: timestamp("end_date"),
	rent: integer("rent").notNull(),
	deposit: integer("deposit"),
	status: text("status", {
		enum: LEASE_STATUS_VALUES,
	}).notNull(),
	referenceId: text("reference_id").references(() => user.id),
	...auditColumns(),
});

// ═══════════════════════════════════════════════════════════
// ****** Accounting **************
// ═══════════════════════════════════════════════════════════

export const utilities = pgTable("utilities", {
	...idColumn(),
	leaseId: text("lease_id")
		.notNull()
		.references(() => leases.id, { onDelete: "cascade" }),
	utilityType: text("utility_type", {
		enum: UTILITY_TYPE_VALUES,
	}).notNull(),
	readingDate: timestamp("reading_date").notNull(),
	ratePerUnit: real("rate_per_unit"),
	unitsUsed: real("units_used").notNull(),
	previousReading: real("previous_reading").notNull(),
	currentReading: real("current_reading").notNull(),
	fixedCharge: integer("fixed_charge"),
	totalAmount: integer("total_amount").notNull(),
	isPaid: boolean("is_paid").notNull().default(false),
	...auditColumns(),
});

export const payments = pgTable("payments", {
	...idColumn(),
	leaseId: text("lease_id")
		.notNull()
		.references(() => leases.id, { onDelete: "cascade" }),
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
	utilityId: text("utility_id").references(() => utilities.id),
	...auditColumns(),
});

// ═══════════════════════════════════════════════════════════
// TENANCY: Invites, Profiles
// Order matters — tenantProfiles before documentUpdateRequests
// ═══════════════════════════════════════════════════════════

export const tenantInvites = pgTable("tenant_invites", {
	...idColumn(),
	name: text("name").notNull(),
	phone: text("phone"),
	email: text("email").notNull(), // to invite
	emergencyContact: text("emergency_contact"),
	notes: text("notes"), // Owner-private, never shown to tenant
	token: text("token").unique().notNull(), // secret to validate user
	expiresAt: timestamp("expires_at"),
	invitedById: text("invited_by")
		.notNull()
		.references(() => user.id),
	status: text("status", {
		enum: INVITE_STATUS_VALUES,
	}).default(INVITE_STATUSES.PENDING),
	...auditColumns(),
});

export const tenantProfiles = pgTable("tenant_profiles", {
	...idColumn(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	// Business rule enforcedin API layer, not db layer
	// Immutable after first set - can change only after approval
	uidNumber: text("uid_number").unique(),
	panNumber: text("pan_number").unique(),
	profileImage: text("profile_iamge"),
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
	verificationNotes: text("verfication_notes"), // Owner private
	verifiedById: text("verified_by").references(() => user.id),
	verifiedAt: timestamp("verified_at"),

	// Audit
	invitedId: text("invite_id").references(() => tenantInvites.id),
	createdById: text("created_by").references(() => user.id),
	...auditColumns(),
});

//  owner-controlled document modification workflow
export const documentUpdateRequests = pgTable("document_update_requests", {
	...idColumn(),
	tenantProfileId: text("tenant_profile_id")
		.notNull()
		.references(() => tenantProfiles.id, { onDelete: "cascade" }), // ← forward ref OK in .references()
	requestedById: text("requested_by_id")
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
	reviewedById: text("reviewed_by_id").references(() => user.id),
	reviewedAt: timestamp("reviewed_at"),
	ownerNotes: text("owner_notes"),
	// The Aproval window - when does the unlock expire
	approvedExpiresAt: timestamp("approved_expires_at"),
	completedAt: timestamp("completed_at"),
	newValueSubmitted: text("new_value"),
	...auditColumns(),
});

export const ownerProfiles = pgTable("owner_profiles", {
	...idColumn(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	companyName: text("company_name").notNull(),
	address: text("address"),
	gstNumber: text("gst_number"),
	upiId: text("upi_id"),
});

export const referrers = pgTable("referrers", {
	...idColumn(),
	referredUserId: text("referred_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	note: text("note"),
	...auditColumns(),
});
