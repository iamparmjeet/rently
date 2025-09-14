import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  INVITE_STATUS_VALUES,
  LEASE_STATUS_VALUES,
  PAYMENT_TYPE_VALUES,
  PROPERTY_TYPES_VALUES,
  UNIT_STATUS_VALUES,
  UNIT_TYPES_VALUES,
  UTILITY_TYPE_VALUES,
} from "@/constants/rent-constants";
import { generateUUID } from "@/utils";
import { user } from "./auth";

export const properties = sqliteTable("properties", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("type", { enum: PROPERTY_TYPES_VALUES }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const units = sqliteTable("units", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  propertyId: text("property_id")
    .notNull()
    .references(() => properties.id),
  unitNumber: text("unit_number").notNull(),
  type: text("type", { enum: UNIT_TYPES_VALUES }).notNull(),
  area: real("area"),
  baseRent: real("base_rent").notNull(),
  description: text("description"),
  status: text("status", { enum: UNIT_STATUS_VALUES }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const leases = sqliteTable("leases", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  unitId: text("unit_id")
    .notNull()
    .references(() => units.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => user.id),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }),
  rent: real("rent").notNull(),
  deposit: real("deposit"),
  status: text("status", {
    enum: LEASE_STATUS_VALUES,
  }).notNull(),
  referenceId: text("reference_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const utilities = sqliteTable("utilities", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  leaseId: text("lease_id")
    .notNull()
    .references(() => leases.id),
  utilityType: text("utility_type", {
    enum: UTILITY_TYPE_VALUES,
  }).notNull(),
  readingDate: integer("reading_date", { mode: "timestamp" }).notNull(),
  ratePerUnit: real("rate_per_unit"),
  unitsUsed: real("units_used"),
  previousReading: real("previous_reading"),
  currentReading: real("current_reading"),
  fixedCharge: real("fixed_charge"),
  totalAmount: real("total_amount").notNull(),
  isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  leaseId: text("lease_id")
    .notNull()
    .references(() => leases.id),
  amount: real("amount").notNull(),
  paymentDate: integer("payment_date", { mode: "timestamp" }).notNull(),
  type: text("type", {
    enum: PAYMENT_TYPE_VALUES,
  }).notNull(),
  description: text("description"),
  utilityId: text("utility_id").references(() => utilities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const referrers = sqliteTable("referrers", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  referredUserId: text("referred_user_id")
    .notNull()
    .references(() => user.id),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const tenantInvites = sqliteTable("tenant_invites", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  email: text("email").notNull(), // to invite
  token: text("token").unique().notNull(), // secret to validate user
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  invitedById: text("invited_by")
    .notNull()
    .references(() => user.id),
  status: text("status", {
    enum: INVITE_STATUS_VALUES,
  }).default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$onUpdate(() => new Date())
    .notNull(),
});
