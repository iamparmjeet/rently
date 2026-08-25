import { GST_RATES } from "@rently/db/constants/payment-constants";
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
export const UpsertOwnerProfileSchema = z
	.object({
		companyName: z.string().optional(),
		address: z.string().optional(),
		gstNumber: z
			.string()
			.regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
			.optional()
			.or(z.literal("")),
		gstEnabled: z.boolean().optional(),
		gstRateRent: z
			.number()
			.refine((v) => (GST_RATES as readonly number[]).includes(v), {
				message: "Rate must be 0/5/12/18",
			})
			.optional(),
		gstRateMaintenance: z
			.number()
			.refine((v) => (GST_RATES as readonly number[]).includes(v), {
				message: "Rate must be 0/5/12/18",
			})
			.optional(),
		upiId: z.string().optional(),
		// TODO: add bio and preferredCurrency after DB migration adds those columns
	})
	.superRefine((v, ctx) => {
		if (v.gstEnabled && !v.gstNumber) {
			ctx.addIssue({
				code: "custom",
				path: ["gstEnabled"],
				message: "Add GSTIN before enabling GST",
			});
		}
		if (
			v.gstNumber &&
			v.gstNumber !== "" &&
			!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.gstNumber)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["gstNumber"],
				message: "Invalid GSTIN",
			});
		}
	});

// ── Layer 3: Inferred TS types — never write these by hand
export type OwnerProfileSelect = z.infer<typeof OwnerProfileSelectSchema>;
export type UpsertOwnerProfileInput = z.infer<typeof UpsertOwnerProfileSchema>;
