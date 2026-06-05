import {
	INVITE_STATUS_VALUES,
	INVITE_STATUSES,
	LEASE_STATUS_VALUES,
	PAYMENT_TYPE_VALUES,
	PROPERTY_TYPES_VALUES,
	UNIT_FURNISHING_VALUES,
	UNIT_STATUS_VALUES,
	UNIT_TYPES_VALUES,
	UTILITY_TYPE_VALUES,
} from "@rently/db/constants/rent-constants";
import {
	boolean,
	integer,
	numeric,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { PAYMENT_METHOD_VALUES } from "../constants/payment-constants";
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

export const units = pgTable("units", {
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
});

export const leases = pgTable("leases", {
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
	...auditColumns(),
});

// ═══════════════════════════════════════════════════════════
// ****** Accounting **************
// ═══════════════════════════════════════════════════════════

export const utilities = pgTable("utilities", {
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
});

export const payments = pgTable("payments", {
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
	invitedById: uuid("invited_by")
		.notNull()
		.references(() => user.id),
	status: text("status", {
		enum: INVITE_STATUS_VALUES,
	}).default(INVITE_STATUSES.PENDING),
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
	uidNumber: text("uid_number").unique(),
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

//  owner-controlled document modification workflow
export const documentUpdateRequests = pgTable("document_update_requests", {
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
});

export const ownerProfiles = pgTable("owner_profiles", {
	...idColumn(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	companyName: text("company_name").notNull(),
	address: text("address"),
	gstNumber: text("gst_number"),
	upiId: text("upi_id"),
	...auditColumns(),
	...softDeleteColumn(),
});

export const referrers = pgTable("referrers", {
	...idColumn(),
	referredUserId: uuid("referred_user_id")
		.notNull()
		.references(() => user.id, { onDelete: "restrict" }),
	note: text("note"),
	...auditColumns(),
	...softDeleteColumn(),
});
