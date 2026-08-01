// bun packages/db/src/seed/plans.ts
// Run once after migration to populate the plans table.
// Safe to re-run: onConflictDoNothing() skips existing slugs.
import { eq } from "drizzle-orm";
import { createDb } from "../index";
import { plans } from "../schema/subscription";
import { generatedId } from "../utils/id";

const PLANS = [
	{
		slug: "free",
		name: "Starter",
		description: "Free · Up to 10 active tenants",
		tenantLimit: 10,
		priceMonthly: 0,
		priceQuarterly: 0,
		priceHalfYearly: 0,
		priceYearly: 0,
		priceTwoYear: 0,
	},
	{
		slug: "pro",
		name: "Pro",
		description: "Up to 500 active tenants · Priority support",
		tenantLimit: 500,
		// All prices in paise: ₹499/mo base
		priceMonthly: 49900,
		priceQuarterly: 142320, // 499 * 3 * 0.95
		priceHalfYearly: 269460, // 499 * 6 * 0.90
		priceYearly: 509898, // 499 * 12 * 0.85
		priceTwoYear: 958080, // 499 * 24 * 0.80
	},
	{
		slug: "enterprise",
		name: "Enterprise",
		description: "Not available during beta",
		tenantLimit: 9999,
		// ₹1,499/mo base
		priceMonthly: 149900,
		priceQuarterly: 427215,
		priceHalfYearly: 809460,
		priceYearly: 1529298,
		priceTwoYear: 2877120,
	},
] as const;

async function seed() {
	const db = createDb();

	console.log("Seeding plans...");

	for (const plan of PLANS) {
		const existing = await db
			.select({ id: plans.id })
			.from(plans)
			.where(eq(plans.slug, plan.slug))
			.limit(1);

		if (existing.length > 0) {
			console.log(`  ⏭  ${plan.slug} already exists — skipping`);
			continue;
		}

		await db.insert(plans).values({ id: generatedId(), ...plan });
		console.log(`  ✓  ${plan.slug} inserted`);
	}

	console.log("Done.");
	process.exit(0);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
