import { protectedProcedure } from "@rently/api/index";
import {
	CreatePropertySchema,
	PropertySchema,
	UpdatePropertySchema,
} from "@rently/api/types/rent-types";
import type { AppBindings } from "@rently/api/types/types";
import {
	badRequest,
	forbidden,
	notFound,
	StatusCode,
	safeHandler,
	safeJson,
	success,
} from "@rently/api/utils";
import { properties } from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import z from "zod";

export const propertyRouter = {
	create: protectedProcedure
		.route({
			method: "POST",
			path: "/properties",
			successStatus: StatusCode.CREATED,
		})
		.input(CreatePropertySchema)
		.output(z.object({ property: PropertySchema }))
		.handler(async ({ input, context }) => {
			const [property] = await context.db
				.insert(properties)
				.values({
					ownerId: context.session.user.id,
					name: input.name,
					address: input.address,
					type: input.type,
				})
				.returning();

			return { property };
		}),
};

// 1) Create Property

export const create = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");
	const paylaod = await safeJson(c);

	const result = CreatePropertySchema.safeParse(await c.req.json());
	if (!result.success) {
		console.error("Error Parsing Property Data", result.error);
		return badRequest(c);
	}

	const payload = result.data;
	// console.log("Payload", payload)

	try {
		const [property] = await db
			.insert(properties)
			.values({
				ownerId: user.id,
				name: payload.name,
				address: payload.address,
				type: payload.type,
			})
			.returning();

		return success(c, { property });
	} catch (err) {
		console.error("Property Create Error", err);
		return badRequest(c, "Property Create Error", err);
	}
});

// 2) Get All
export const getAll = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");

	try {
		const list = await db.query.properties.findMany({
			where: (prop, { eq }) => eq(prop.ownerId, user.id),
		});

		return success(c, { properties: list });
	} catch (err) {
		console.error("Property List error", err);
		return badRequest(c, "Failed to Fetch Properties", err);
	}
});

// 3) Get Single Property By Id
export const getById = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");
	const propertyId = c.req.param("id");

	if (!propertyId) {
		return badRequest(c, "Property ID is required");
	}

	const owns = await isPropertyOwner(c, user.id, propertyId);
	if (!owns) return forbidden(c, "You do not own this property");

	const property = await db.query.properties.findFirst({
		where: (prop, { eq }) => eq(prop.id, propertyId),
	});

	if (!property) return notFound(c, "Property Not Found");

	return success(c, { property });
});

// 4) Update Property
export const update = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");
	const propertyId = c.req.param("id");
	const payload = await safeJson(c);

	if (!propertyId) {
		return badRequest(c, "Property ID is required");
	}

	const result = UpdatePropertySchema.safeParse(payload);

	if (!result.success) {
		return badRequest(c, "Validation Failed", result.error);
	}

	const updates = result.data;

	const owns = await isPropertyOwner(c, user.id, propertyId);
	if (!owns) return forbidden(c, "You do not own this property");

	try {
		const [updated] = await db
			.update(properties)
			.set({
				...updates,
				updatedAt: new Date(),
			})
			.where(eq(properties.id, propertyId))
			.returning();
		return success(c, { property: updated });
	} catch (err) {
		console.error("Error while Updating", err);
		return badRequest(c, "Updation Failed", err);
	}
});

// 5) Delete Property
export const remove = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");
	const propertyId = c.req.param("id");

	if (!propertyId) {
		return badRequest(c, "Property ID is required");
	}

	const owns = await isPropertyOwner(c, user.id, propertyId);
	if (!owns) return forbidden(c, "You do not own this property");

	try {
		await db.delete(properties).where(eq(properties.id, propertyId));
		return success(c, { deleted: true });
	} catch (err) {
		console.error("Delete Error", err);
		return badRequest(c, "Deletion Failed", err);
	}
});

// 6_ Get Units for a specific property
export const getPropertyUnits = safeHandler(async (c: Context<AppBindings>) => {
	const db = c.get("db");
	const user = c.get("user");
	const propertyId = c.req.param("id");

	if (!propertyId) {
		return badRequest(c, "Property ID is required");
	}

	//ownership
	const owns = await isPropertyOwner(c, user.id, propertyId);
	if (!owns) return forbidden(c, "You do not own this property");

	try {
		const unitsList = await db.query.units.findMany({
			where: (unit, { eq }) => eq(unit.propertyId, propertyId),
			orderBy: (unit, { asc }) => [asc(unit.unitNumber)],
		});

		return success(c, { units: unitsList });
	} catch (err) {
		console.error("Property Units Fetch Error", err);
		return badRequest(c, "Failed to fetch units for Property", err);
	}
});
