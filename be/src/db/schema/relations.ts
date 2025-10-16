import { relations } from "drizzle-orm";
import {
  leases,
  payments,
  properties,
  units,
  user,
  utilities,
} from "@/db/schema";

// 1️⃣ Property ↔ Owner (user)
export const propertyRelations = relations(properties, ({ one, many }) => ({
  owner: one(user, {
    fields: [properties.ownerId],
    references: [user.id],
  }),
  units: many(units),
}));

// 2️⃣ Unit ↔ Property & Leases
export const unitRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),
  leases: many(leases),
}));

// 3️⃣ Lease ↔ Unit & Tenant/User
export const leaseRelations = relations(leases, ({ one }) => ({
  unit: one(units, {
    fields: [leases.unitId],
    references: [units.id],
  }),
  tenant: one(user, {
    fields: [leases.tenantId],
    references: [user.id],
  }),
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
