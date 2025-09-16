import { boolean, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
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

export const properties = pgTable("properties", {
  id: text("id").primaryKey().notNull().$defaultFn(generateUUID),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("type", { enum: PROPERTY_TYPES_VALUES }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const units = pgTable("units", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const leases = pgTable("leases", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  unitId: text("unit_id")
    .notNull()
    .references(() => units.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => user.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  rent: real("rent").notNull(),
  deposit: real("deposit"),
  status: text("status", {
    enum: LEASE_STATUS_VALUES,
  }).notNull(),
  referenceId: text("reference_id").references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const utilities = pgTable("utilities", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  leaseId: text("lease_id")
    .notNull()
    .references(() => leases.id),
  utilityType: text("utility_type", {
    enum: UTILITY_TYPE_VALUES,
  }).notNull(),
  readingDate: timestamp("reading_date").notNull(),
  ratePerUnit: real("rate_per_unit"),
  unitsUsed: real("units_used"),
  previousReading: real("previous_reading"),
  currentReading: real("current_reading"),
  fixedCharge: real("fixed_charge"),
  totalAmount: real("total_amount").notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  leaseId: text("lease_id")
    .notNull()
    .references(() => leases.id),
  amount: real("amount").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  type: text("type", {
    enum: PAYMENT_TYPE_VALUES,
  }).notNull(),
  description: text("description"),
  utilityId: text("utility_id").references(() => utilities.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const referrers = pgTable("referrers", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  referredUserId: text("referred_user_id")
    .notNull()
    .references(() => user.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tenantInvites = pgTable("tenant_invites", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  email: text("email").notNull(), // to invite
  token: text("token").unique().notNull(), // secret to validate user
  expiresAt: timestamp("expires_at"),
  invitedById: text("invited_by")
    .notNull()
    .references(() => user.id),
  status: text("status", {
    enum: INVITE_STATUS_VALUES,
  }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
