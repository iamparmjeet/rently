import { relations } from "drizzle-orm";
import {
	documentUpdateRequests,
	invoices,
	leases,
	ownerProfiles,
	payments,
	plans,
	properties,
	subscriptions,
	tenantInvites,
	tenantProfiles,
	units,
	user,
	utilities,
} from "./index";

// 1) Property ↔ Owner (user)
export const userRelations = relations(user, ({ one, many }) => ({
	properties: many(properties),
	leases: many(leases),

	tenantProfile: one(tenantProfiles, {
		fields: [user.id],
		references: [tenantProfiles.userId],
	}),
	ownerProfile: one(ownerProfiles, {
		fields: [user.id],
		references: [ownerProfiles.userId],
	}),
	sentInvites: many(tenantInvites, {
		relationName: "invitedBy",
	}),
	subscriptions: many(subscriptions),
}));

export const propertyRelations = relations(properties, ({ one, many }) => ({
	owner: one(user, {
		fields: [properties.ownerId],
		references: [user.id],
	}),
	units: many(units),
}));

// tenantInvites → inviter (user)
export const tenantInviteRelations = relations(tenantInvites, ({ one }) => ({
	invitedBy: one(user, {
		fields: [tenantInvites.invitedById],
		references: [user.id],
		relationName: "invitedBy",
	}),
}));

// 2️) Unit ↔ Property & Leases
export const unitRelations = relations(units, ({ one, many }) => ({
	property: one(properties, {
		fields: [units.propertyId],
		references: [properties.id],
	}),
	leases: many(leases),
}));

// 3️) Lease ↔ Unit & Tenant/User
export const leaseRelations = relations(leases, ({ one, many }) => ({
	unit: one(units, {
		fields: [leases.unitId],
		references: [units.id],
	}),
	tenant: one(user, {
		fields: [leases.tenantId],
		references: [user.id],
	}),
	utilities: many(utilities),
	payments: many(payments),
}));

export const utilityRelations = relations(utilities, ({ one }) => ({
	lease: one(leases, {
		fields: [utilities.leaseId],
		references: [leases.id],
	}),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
	lease: one(leases, {
		fields: [payments.leaseId],
		references: [leases.id],
	}),
	utility: one(utilities, {
		fields: [payments.utilityId],
		references: [utilities.id],
	}),
}));

// subscriptions → user, plan
export const subscriptionRelations = relations(
	subscriptions,
	({ one, many }) => ({
		user: one(user, {
			fields: [subscriptions.userId],
			references: [user.id],
		}),
		plan: one(plans, {
			fields: [subscriptions.planId],
			references: [plans.id],
		}),
		invoices: many(invoices),
	}),
);

// ownerProfiles → user
export const ownerProfileRelations = relations(ownerProfiles, ({ one }) => ({
	user: one(user, {
		fields: [ownerProfiles.userId],
		references: [user.id],
	}),
}));

// tenantProfiles → user
export const tenantProfileRelations = relations(tenantProfiles, ({ one }) => ({
	user: one(user, {
		fields: [tenantProfiles.userId],
		references: [user.id],
	}),
}));

export const tenantProfilesRelations = relations(
	tenantProfiles,
	({ one, many }) => ({
		user: one(user, {
			fields: [tenantProfiles.userId],
			references: [user.id],
		}),
		verifiedBy: one(user, {
			fields: [tenantProfiles.verifiedById],
			references: [user.id],
		}),
		pendingDocumentRequest: one(documentUpdateRequests, {
			fields: [tenantProfiles.id],
			references: [documentUpdateRequests.tenantProfileId],
			relationName: "pendingRequest",
		}),
		documentRequests: many(documentUpdateRequests),
	}),
);

export const documentUpdateRequestsRelations = relations(
	documentUpdateRequests,
	({ one }) => ({
		tenant: one(tenantProfiles, {
			fields: [documentUpdateRequests.tenantProfileId],
			references: [tenantProfiles.id],
		}),
		requestedBy: one(user, {
			fields: [documentUpdateRequests.requestedById],
			references: [user.id],
		}),
		reviewedBy: one(user, {
			fields: [documentUpdateRequests.reviewedById],
			references: [user.id],
		}),
	}),
);
