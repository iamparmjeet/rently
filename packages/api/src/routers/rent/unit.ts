import { ORPCError } from "@orpc/client";
import { VerifyUnitOwnership } from "@rently/api/helpers";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import { properties, units } from "@rently/db/schema/schema";
import {
	CreateUnitSchema,
	UnitSelectSchema,
	UnitWithPropertyNameSchema,
	UpdateUnitSchema,
} from "@rently/validators";
import { and, eq } from "drizzle-orm";
import z from "zod";

//create
export const createUnit = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/unit/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateUnitSchema)
	.output(z.object({ unit: UnitSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Verify user ownes the parent property before allowing unit creation
		const [property] = await db
			.select({ ownerId: properties.ownerId })
			.from(properties)
			.where(eq(properties.id, input.propertyId))
			.limit(1);

		if (!property) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Property Not Found",
			});
		}

		if (property.ownerId !== user.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "you don't own this property",
			});
		}

		//
		const [unit] = await db
			.insert(units)
			.values({
				...input,
				status: "available",
			})
			.returning();

		if (!unit) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create unit",
			});
		}

		return { unit };
	});

// update
export const updateUnit = protectedProcedure
	.route({ method: "PATCH", path: "/rent/unit/update" })
	.input(z.object({ id: z.string(), data: UpdateUnitSchema }))
	.output(z.object({ unit: UnitSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Verfiy ownership
		await VerifyUnitOwnership(db, user.id, input.id);

		const [unit] = await db
			.update(units)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(units.id, input.id))
			.returning();

		if (!unit) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Unit not found after update",
			});
		}

		return { unit };
	});

// getbyId
export const getUnitById = protectedProcedure
	.route({ method: "GET", path: "/rent/unit/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ unit: UnitWithPropertyNameSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [result] = await db
			.select({
				id: units.id,
				propertyId: units.propertyId,
				unitNumber: units.unitNumber,
				type: units.type,
				area: units.area,
				baseRent: units.baseRent,
				description: units.description,
				status: units.status,
				createdAt: units.createdAt,
				updatedAt: units.updatedAt,
				propertyName: properties.name,
				ownerId: properties.ownerId,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(eq(units.id, input.id))
			.limit(1);

		if (!result) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: `Unit ${input.id} not found`,
			});
		}

		if (result.ownerId !== user.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "you don't have access to this unit",
			});
		}

		const { ownerId, ...unit } = result;
		return { unit };
	});

// getAll
export const listUnits = protectedProcedure
	.route({ method: "GET", path: "/rent/unit/list" })
	.input(z.object({ propertyId: z.string().optional() }))
	.output(z.object({ units: z.array(UnitWithPropertyNameSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const whereClause = input.propertyId
			? and(
					eq(properties.ownerId, user.id),
					eq(units.propertyId, input.propertyId),
				)
			: eq(properties.ownerId, user.id);

		const result = await db
			.select({
				id: units.id,
				propertyId: units.propertyId,
				unitNumber: units.unitNumber,
				type: units.type,
				area: units.area,
				baseRent: units.baseRent,
				description: units.description,
				status: units.status,
				createdAt: units.createdAt,
				updatedAt: units.updatedAt,
				propertyName: properties.name,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(whereClause)
			.orderBy(units.unitNumber);

		return { units: result };
	});

// remove
export const deleteUnit = protectedProcedure
	.route({ method: "DELETE", path: "/rent/unit/delete" })
	.input(z.object({ id: z.string() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		//verfiy Ownership
		await VerifyUnitOwnership(db, user.id, input.id);
		await db.delete(units).where(eq(units.id, input.id));
	});
