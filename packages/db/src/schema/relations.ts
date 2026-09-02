import { relations } from "drizzle-orm";
import { adminAuditLogs } from "./admin";
import {
	documentUpdateRequests,
	invoices,
	leaseAgreements,
	leases,
	notificationPreferences,
	ownerProfiles,
	paymentGroups,
	payments,
	plans,
	properties,
	subscriptions,
	tenantDocuments,
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
	notificationPreferences: one(notificationPreferences, {
		fields: [user.id],
		references: [notificationPreferences.ownerId],
	}),
	adminAuditLogs: many(adminAuditLogs),
	leaseAgreements: many(leaseAgreements),
}));

export const adminAuditLogRelations = relations(adminAuditLogs, ({ one }) => ({
	actorAdmin: one(user, {
		fields: [adminAuditLogs.actorAdminUserId],
		references: [user.id],
	}),
}));

export const notificationPreferencesRelations = relations(
	notificationPreferences,
	({ one }) => ({
		owner: one(user, {
			fields: [notificationPreferences.ownerId],
			references: [user.id],
		}),
	}),
);

export const propertyRelations = relations(properties, ({ one, many }) => ({
	owner: one(user, {
		fields: [properties.ownerId],
		references: [user.id],
	}),
	units: many(units),
	leaseAgreements: many(leaseAgreements),
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
	agreement: one(leaseAgreements, {
		fields: [leases.agreementId],
		references: [leaseAgreements.id],
	}),
}));

export const leaseAgreementRelations = relations(
	leaseAgreements,
	({ one, many }) => ({
		tenant: one(user, {
			fields: [leaseAgreements.tenantId],
			references: [user.id],
		}),
		property: one(properties, {
			fields: [leaseAgreements.propertyId],
			references: [properties.id],
		}),
		leases: many(leases),
		paymentGroups: many(paymentGroups),
	}),
);

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
	group: one(paymentGroups, {
		fields: [payments.paymentGroupId],
		references: [paymentGroups.id],
	}),
}));

export const paymentGroupRelations = relations(
	paymentGroups,
	({ one, many }) => ({
		agreement: one(leaseAgreements, {
			fields: [paymentGroups.agreementId],
			references: [leaseAgreements.id],
		}),
		allocations: many(payments),
		reverses: one(paymentGroups, {
			relationName: "paymentGroupReversal",
			fields: [paymentGroups.reversesPaymentGroupId],
			references: [paymentGroups.id],
		}),
		reversedBy: many(paymentGroups, {
			relationName: "paymentGroupReversal",
		}),
	}),
);

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
		documents: many(tenantDocuments),
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
		sourceDocument: one(tenantDocuments, {
			fields: [documentUpdateRequests.sourceDocumentId],
			references: [tenantDocuments.id],
			relationName: "sourceDocument",
		}),
		replacementDocument: one(tenantDocuments, {
			fields: [documentUpdateRequests.replacementDocumentId],
			references: [tenantDocuments.id],
			relationName: "replacementDocument",
		}),
	}),
);

export const tenantDocumentsRelations = relations(
	tenantDocuments,
	({ one }) => ({
		tenant: one(tenantProfiles, {
			fields: [tenantDocuments.tenantProfileId],
			references: [tenantProfiles.id],
		}),
		owner: one(user, {
			fields: [tenantDocuments.ownerId],
			references: [user.id],
			relationName: "documentOwner",
		}),
		submittedBy: one(user, {
			fields: [tenantDocuments.submittedById],
			references: [user.id],
			relationName: "documentSubmitter",
		}),
		updateRequest: one(documentUpdateRequests, {
			fields: [tenantDocuments.updateRequestId],
			references: [documentUpdateRequests.id],
		}),
	}),
);
