import {
	betaAccessCodes,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// ── Layer 1: DB-derived ─────
export const PlanSelectSchema = createSelectSchema(plans);
export const SubscriptionSelectSchema = createSelectSchema(subscriptions);
export const InvoiceSelectSchema = createSelectSchema(invoices);
export const BetaAccessCodeSelectSchema = createSelectSchema(betaAccessCodes);

export const PlanInsertSchema = createInsertSchema(plans);

// ── Layer 2: API input shapes ──
export const RedeemBetaCodeSchema = z.object({
	code: z
		.string()
		.min(4, { error: "Code must be at least 4 characters" })
		.transform((s) => s.trim().toUpperCase()),
});

// ── Layer 3: Enriched response shapes ─
export const SubscriptionWithPlanSchema = SubscriptionSelectSchema.extend({
	plan: PlanSelectSchema,
});

export const MySubscriptionResponseSchema = z.object({
	// null means no subscription row found (edge case: hook failed at registration)
	subscription: SubscriptionWithPlanSchema.nullable(),
	invoices: z.array(InvoiceSelectSchema),
});

// ── TS types
export type PlanSelect = z.infer<typeof PlanSelectSchema>;
export type SubscriptionSelect = z.infer<typeof SubscriptionSelectSchema>;
export type InvoiceSelect = z.infer<typeof InvoiceSelectSchema>;
export type SubscriptionWithPlan = z.infer<typeof SubscriptionWithPlanSchema>;
export type MySubscriptionResponse = z.infer<
	typeof MySubscriptionResponseSchema
>;
export type RedeemBetaCodeInput = z.infer<typeof RedeemBetaCodeSchema>;
