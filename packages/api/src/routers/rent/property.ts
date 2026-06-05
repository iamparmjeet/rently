import { ORPCError } from "@orpc/server";
import { leases, properties, units } from "@rently/db/schema/schema";
import type { PropertyWithStats } from "@rently/validators";
import {
	CreatePropertySchema,
	PropertySelectSchema,
	PropertyWithStatsSchema,
	UnitSelectSchema,
	UpdatePropertySchema,
} from "@rently/validators";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { ownerProcedure } from "../../procedures";
import { StatusCode } from "../../utils";

// 1) list all Properties
export const listProperties = ownerProcedure
	.route({ method: "GET", path: "/rent/property/list" }) // for OPENAPI
	.output(z.object({ properties: z.array(PropertyWithStatsSchema) }))
	.handler(
		async ({ context }): Promise<{ properties: PropertyWithStats[] }> => {
			const { db, user } = context;

			const rows = await db
				.select({
					id: properties.id,
					ownerId: properties.ownerId,
					name: properties.name,
					address: properties.address,
					type: properties.type,
					createdAt: properties.createdAt,
					updatedAt: properties.updatedAt,
					deletedAt: properties.deletedAt,
					totalUnits: count(units.id),
					occupiedUnits:
						sql<number>`count(case when ${units.status} = 'occupied' then 1 end)`.mapWith(
							Number,
						),
					yearBuilt: properties.yearBuilt,
					totalArea: properties.totalArea,
					floors: properties.floors,
					monthlyRevenue: sql<number>`coalesce(sum(${leases.rent}), 0)`.mapWith(
						Number,
					),
					description: properties.description,
				})
				.from(properties)
				.leftJoin(units, eq(units.propertyId, properties.id))
				.leftJoin(
					leases,
					and(eq(leases.unitId, units.id), eq(leases.status, "active")),
				)
				.where(
					and(eq(properties.ownerId, user.id), isNull(properties.deletedAt)),
				)
				.groupBy(properties.id)
				.orderBy(properties.createdAt);
			return {
				properties: rows.map((row) => ({
					...row,
					availableUnits: row.totalUnits - row.occupiedUnits,
				})),
			};
		},
	);

// 2) get Single Property

export const getPropertyById = ownerProcedure
	.route({ method: "GET", path: "/rent/property/get" })
	.input(z.object({ id: z.uuid() }))
	.output(z.object({ property: PropertySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [property] = await db
			.select()
			.from(properties)
			.where(and(eq(properties.id, input.id), isNull(properties.deletedAt)));

		if (!property) {
			throw new ORPCError("NOT_FOUND", {
				message: `Property ${input.id} not found`,
			});
		}

		// Authorization - Property Belongs to current user
		if (property.ownerId !== user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not have access to this property",
			});
		}

		return { property };
	});

// 3) Create Property
export const createProperty = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/property/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreatePropertySchema)
	.output(z.object({ property: PropertySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [property] = await db
			.insert(properties)
			.values({
				name: input.name,
				address: input.address,
				type: input.type,
				ownerId: user.id,
				floors: input.floors,
				description: input.description,
				yearBuilt: input.yearBuilt,
				totalArea: input.totalArea,
			})
			.returning();

		if (!property) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create Property",
			});
		}

		return { property };
	});

// 4) Update Property
export const updateProperty = ownerProcedure
	.route({ method: "PATCH", path: "/rent/property/update" })
	.input(z.object({ id: z.uuid(), data: UpdatePropertySchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// First Verify ownership
		const [existing] = await db
			.select()
			.from(properties)
			.where(eq(properties.id, input.id));

		if (!existing) throw new ORPCError("NOT_FOUND");

		if (existing.ownerId !== user.id) throw new ORPCError("FORBIDDEN");

		const [updated] = await db
			.update(properties)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(properties.id, input.id))
			.returning();

		return { property: updated };
	});

// 5) Delete
export const deleteProperty = ownerProcedure
	.route({ method: "DELETE", path: "/rent/property/delete" })
	.input(z.object({ id: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [existing] = await db
			.select()
			.from(properties)
			.where(eq(properties.id, input.id));

		if (!existing) throw new ORPCError("NOT_FOUND");
		if (existing.ownerId !== user.id) throw new ORPCError("FORBIDDEN");

		const activeUnits = await db
			.select({ id: units.id })
			.from(units)
			.where(and(eq(units.propertyId, input.id), isNull(units.deletedAt)))
			.limit(1);

		if (activeUnits.length > 0) {
			throw new ORPCError("CONFLICT", {
				message:
					"Cannot arhieve a property with active units. Archieve all units first.",
			});
		}

		await db
			.update(properties)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(properties.id, input.id));

		return { success: true };
	});

// 6_ Get Units for a specific property
export const getUnits = ownerProcedure
	.route({ method: "GET", path: "/rent/property/units" })
	.input(z.object({ propertyId: z.uuid() }))
	.output(z.object({ units: z.array(UnitSelectSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Verify Ownership
		const [property] = await db
			.select({ ownerId: properties.ownerId })
			.from(properties)
			.where(eq(properties.id, input.propertyId));

		if (!property) {
			throw new ORPCError("NOT_FOUND", {
				message: "Property Not Found",
			});
		}
		if (property.ownerId !== user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this property",
			});
		}

		const unitsList = await db
			.select()
			.from(units)
			.where(eq(units.propertyId, input.propertyId));

		return { units: unitsList };
	});

// 7 GetSpecificpropertyUnits

// export const getPropertyUnits = safeHandler(async (c: Context<AppBindings>) => {
// 	const db = c.get("db");
// 	const user = c.get("user");
// 	const propertyId = c.req.param("id");

// 	if (!propertyId) {
// 		return badRequest(c, "Property ID is required");
// 	}

// 	//ownership
// 	const owns = await isPropertyOwner(c, user.id, propertyId);
// 	if (!owns) return forbidden(c, "You do not own this property");

// 	try {
// 		const unitsList = await db.query.units.findMany({
// 			where: (unit, { eq }) => eq(unit.propertyId, propertyId),
// 			orderBy: (unit, { asc }) => [asc(unit.unitNumber)],
// 		});

// 		return success(c, { units: unitsList });
// 	} catch (err) {
// 		console.error("Property Units Fetch Error", err);
// 		return badRequest(c, "Failed to fetch units for Property", err);
// 	}
// });
