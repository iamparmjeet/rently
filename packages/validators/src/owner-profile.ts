import { ownerProfiles } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ── Layer 1: DB-derived base schemas ────────────────
export const OwnerProfileSelectSchema = createSelectSchema(ownerProfiles);
export const OwnerProfileInsertSchema = createInsertSchema(ownerProfiles);
export const OwnerProfileUpdateSchema = createUpdateSchema(ownerProfiles);

// ── Layer 2: API input shapes ──

// .partial(): this is an upsert — on first save the profile may not exist,
// and we don't want to force the user to fill every field before saving.
// companyName is notNull in DB — we default to "" on insert if not provided.
export const UpsertOwnerProfileSchema = z.object({
	companyName: z.string().optional(),
	address: z.string().optional(),
	gstNumber: z.string().optional(),
	upiId: z.string().optional(),
	// TODO: add bio and preferredCurrency after DB migration adds those columns
});

// ── Layer 3: Inferred TS types — never write these by hand
export type OwnerProfileSelect = z.infer<typeof OwnerProfileSelectSchema>;
export type UpsertOwnerProfileInput = z.infer<typeof UpsertOwnerProfileSchema>;
