import { ORPCError } from "@orpc/client";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import { properties } from "@rently/db/schema/schema";
import type { Property } from "@rently/db/types";
import {
	CreatePropertySchema,
	PropertySchema,
	UpdatePropertySchema,
} from "@rently/validators";
import { eq } from "drizzle-orm";
import z from "zod";

// 1) list all Properties
export const listProperties = protectedProcedure
	.route({ method: "GET", path: "/rent/property/lists" }) // for OPENAPI
	.output(z.object({ properties: z.array(PropertySchema) }))
	.handler(async ({ context }): Promise<{ properties: Property[] }> => {
		const { db, user } = context;

		const res = await db
			.select()
			.from(properties)
			.where(eq(properties.ownerId, user.id))
			.orderBy(properties.createdAt);
		// console.log(
		// 	"Raw Drizzle output:",
		// 	JSON.stringify(res, null, 2),
		// 	session.userId,
		// 	user.id,
		// );
		return { properties: res as Property[] };
	});

// 2) get Single Property

export const getPropertyById = protectedProcedure
	.route({ method: "GET", path: "/rent/property/get" })
	.input(z.object({ id: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [property] = await db
			.select()
			.from(properties)
			.where(eq(properties.id, input.id));

		if (!property) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: `Property ${input.id} not found`,
			});
		}

		// Authorization - Property Belongs to current user
		if (property.ownerId !== user.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not have access to this property",
			});
		}

		return { property };
	});

// 3) Create Property
export const createProperty = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/property/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreatePropertySchema)
	// .output(z.object({ property: CreatePropertySchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [property] = await db
			.insert(properties)
			.values({
				id: crypto.randomUUID(),
				name: input.name,
				address: input.address,
				type: input.type,
				ownerId: user.id,
			})
			.returning();

		if (!property) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create Property",
			});
		}

		return { property };
	});

// 4) Update Property
export const updateProperty = protectedProcedure
	.route({ method: "PATCH", path: "/rent/property/update" })
	.input(z.object({ id: z.uuid(), data: UpdatePropertySchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// First Verify ownership
		const [existing] = await db
			.select()
			.from(properties)
			.where(eq(properties.id, input.id));

		if (!existing) throw new ORPCError(StatusPhrase.NOT_FOUND);

		if (existing.ownerId !== user.id)
			throw new ORPCError(StatusPhrase.FORBIDDEN);

		const [updated] = await db
			.update(properties)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(properties.id, input.id))
			.returning();

		return { property: updated };
	});

// 5) Delete
export const deleteProperty = protectedProcedure
	.route({ method: "DELETE", path: "/rent/property/delete" })
	.input(z.object({ id: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [existing] = await db
			.select()
			.from(properties)
			.where(eq(properties.id, input.id));

		if (!existing) throw new ORPCError(StatusPhrase.NOT_FOUND);
		if (existing.ownerId !== user.id)
			throw new ORPCError(StatusPhrase.FORBIDDEN);

		await db.delete(properties).where(eq(properties.id, input.id));
	});

// 6_ Get Units for a specific property

// export const getPropertyUnits = protectedProcedure
// 	.route({ method: "GET", path: "/rent/property/get" })
// 	.input(z.object({ id: z.uuid() }))
// 	.handler(async ({ context, input }) => {
// 		const { db, user } = context;

// 		const [property] = await db
// 			.select()
// 			.from(properties)
// 			.where(eq(properties.ownerId, user.id));

// 		if (!property) {
// 			throw new ORPCError(StatusPhrase.NOT_FOUND, {
// 				message: "Property Not Found",
// 			});
//     }

//     const [unitList] = await db
//       .select()
//       .from(units)
//       .where(eq(units.propertyId, ))

// 	});

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
