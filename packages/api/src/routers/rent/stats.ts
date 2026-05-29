import { leases, properties, units } from "@rently/db/schema/schema";
import { and, count, eq } from "drizzle-orm";
import z from "zod";
import { ownerProcedure } from "../../procedures";

const DashboardStatsSchema = z.object({
	totalProperties: z.number().int(),
	totalUnits: z.number().int(),
	occupiedUnits: z.number().int(),
	availableUnits: z.number().int(),
	activeLeases: z.number().int(),
	occupancyRate: z.number(),
});

export const getDashboardStats = ownerProcedure
	.route({ method: "GET", path: "/rent/stats/dashboard" })
	.output(DashboardStatsSchema)
	.handler(async ({ context }) => {
		const { db, user } = context;

		// Promise.all — all 4 queries are independent, run them concurrently
		// rather than sequentially. Same connection pool, ~4x faster than await-chaining.
		const [[propsRow], [unitsRow], [occupiedRow], [activeLeasesRow]] =
			await Promise.all([
				// 1) Total properties owned by this user
				db
					.select({ count: count() })
					.from(properties)
					.where(eq(properties.ownerId, user.id)),

				// 2) Total units across all owned properties
				// WHY: innerJoin enforces multi-tenant ownership — only units under THIS user's properties
				db
					.select({ count: count() })
					.from(units)
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(eq(properties.ownerId, user.id)),

				// 3) Occupied units only
				db
					.select({ count: count() })
					.from(units)
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(
						and(eq(properties.ownerId, user.id), eq(units.status, "occupied")),
					),

				// 4) Active leases (lease → unit → property → ownerId)
				db
					.select({ count: count() })
					.from(leases)
					.innerJoin(units, eq(leases.unitId, units.id))
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(
						and(eq(properties.ownerId, user.id), eq(leases.status, "active")),
					),
			]);

		const totalUnits = unitsRow?.count ?? 0;
		const occupiedUnits = occupiedRow?.count ?? 0;

		// WHY: compute derived values on the backend — the frontend gets a finished number,
		// not raw inputs to compute from. Simpler frontend, single source of truth.
		const occupancyRate =
			totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

		return {
			totalProperties: propsRow?.count ?? 0,
			totalUnits,
			occupiedUnits,
			availableUnits: totalUnits - occupiedUnits,
			activeLeases: activeLeasesRow?.count ?? 0,
			occupancyRate,
		};
	});
