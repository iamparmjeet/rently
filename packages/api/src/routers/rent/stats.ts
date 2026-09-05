import { leases, properties, units } from "@rently/db/schema/schema";
import { OverdueLeasesResponseSchema } from "@rently/validators";
import { and, count, eq, isNull } from "drizzle-orm";
import z from "zod";
import { ownerProcedure } from "../../procedures";
import { queryOverdueLeases } from "../helpers/overdue-query";
import { getSignedLedgerPayments } from "../helpers/signed-ledger";

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
					.where(
						and(eq(properties.ownerId, user.id), isNull(properties.deletedAt)),
					),

				// 2) Total units across all owned properties
				// WHY: innerJoin enforces multi-tenant ownership — only units under THIS user's properties
				db
					.select({ count: count() })
					.from(units)
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(
						and(
							eq(properties.ownerId, user.id),
							isNull(properties.deletedAt),
							isNull(units.deletedAt),
						),
					),

				// 3) Occupied units only
				db
					.select({ count: count() })
					.from(units)
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(
						and(
							eq(properties.ownerId, user.id),
							isNull(properties.deletedAt),
							isNull(units.deletedAt),
							eq(units.status, "occupied"),
						),
					),

				// 4) Active leases (lease → unit → property → ownerId)
				db
					.select({ count: count() })
					.from(leases)
					.innerJoin(units, eq(leases.unitId, units.id))
					.innerJoin(properties, eq(units.propertyId, properties.id))
					.where(
						and(
							eq(properties.ownerId, user.id),
							isNull(properties.deletedAt),
							isNull(units.deletedAt),
							eq(leases.status, "active"),
						),
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

// Revenue
const RevenueMonthSchema = z.object({
	monthStart: z.date(),
	total: z.number().int(),
});

const RecentTransactionItemSchema = z.object({
	id: z.string(),
	amount: z.number().int(),
	type: z.string(),
	paymentDate: z.date(),
	tenantName: z.string(),
	description: z.string().nullable(),
});

const RevenueDashboardSchema = z.object({
	revenueByMonth: z.array(RevenueMonthSchema),
	recentTransactions: z.array(RecentTransactionItemSchema),
	totalThisMonth: z.number().int(),
	overdueCount: z.number().int(),
	overdueAmount: z.number().int(),
});

export const getOverdueLeases = ownerProcedure
	.route({ method: "GET", path: "/rent/stats/overdue" })
	.output(OverdueLeasesResponseSchema)
	.handler(async ({ context }) => {
		return {
			leases: await queryOverdueLeases(context.db, new Date(), context.user.id),
		};
	});

export const getRevenueDashboard = ownerProcedure
	.route({ method: "GET", path: "/rent/stats/revenue" })
	.output(RevenueDashboardSchema)
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;
		const now = new Date();

		// 1) 12 Month window
		const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

		// 2) Revenue By Month
		const [revenueRows, allPaymentRows, overdueLeases] = await Promise.all([
			getSignedLedgerPayments(db, {
				ownerId: authUser.id,
				from: twelveMonthsAgo,
			}),
			getSignedLedgerPayments(db, { ownerId: authUser.id }),
			queryOverdueLeases(db, now, authUser.id),
		]);

		const recentRows = [...allPaymentRows]
			.sort(
				(a, b) =>
					b.paymentDate.getTime() - a.paymentDate.getTime() ||
					b.createdAt.getTime() - a.createdAt.getTime() ||
					b.id.localeCompare(a.id),
			)
			.slice(0, 5)
			.map((row) => ({
				id: row.id,
				amount: row.amount,
				type: row.type,
				paymentDate: row.paymentDate,
				tenantName: row.tenantName,
				description: row.description,
			}));

		// 4 ) - Generate All 12 month buckets
		const revenueMap = new Map<string, number>();
		for (const row of revenueRows) {
			if (!row.category) continue;
			const d = row.paymentDate;

			const key = `${d.getFullYear()}-${d.getMonth()}`;
			revenueMap.set(key, (revenueMap.get(key) ?? 0) + row.amount);
		}

		const revenueByMonth = Array.from({ length: 12 }, (_, i) => {
			const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			return {
				monthStart: d,
				total: revenueMap.get(key) ?? 0,
			};
		});

		const totalThisMonth = revenueByMonth[11]?.total ?? 0;

		return {
			revenueByMonth,
			recentTransactions: recentRows,
			totalThisMonth,
			overdueCount: overdueLeases.length,
			overdueAmount: overdueLeases.reduce(
				(total, lease) => total + lease.outstandingAmount,
				0,
			),
		};
	});

//
