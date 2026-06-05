import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import { LEASE_STATUSES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import { leases, properties, units } from "@rently/db/schema/schema";
import {
	CreateUnitSchema,
	UnitSelectSchema,
	UnitWithLeaseSchema,
	UpdateUnitSchema,
} from "@rently/validators";
import { and, eq, isNull } from "drizzle-orm";
import z from "zod";
import { VerifyUnitOwnership } from "../helpers";

//1) create
export const createUnit = ownerProcedure
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
			throw new ORPCError("NOT_FOUND", {
				message: "Property Not Found",
			});
		}

		if (property.ownerId !== user.id) {
			throw new ORPCError("FORBIDDEN", {
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
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create unit",
			});
		}

		return { unit };
	});

// 2) update
export const updateUnit = ownerProcedure
	.route({ method: "PATCH", path: "/rent/unit/update" })
	.input(z.object({ id: z.string(), data: UpdateUnitSchema }))
	.output(z.object({ unit: UnitSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Verfiy ownership
		await VerifyUnitOwnership(db, authUser.id, input.id);

		const [unit] = await db
			.update(units)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(units.id, input.id))
			.returning();

		if (!unit) {
			throw new ORPCError("NOT_FOUND", {
				message: "Unit not found after update",
			});
		}

		return { unit };
	});

// 3) getUnitbyId
export const getUnitById = ownerProcedure
	.route({ method: "GET", path: "/rent/unit/get" })
	.input(z.object({ id: z.string() }))
	.output(
		z.object({
			unit: UnitWithLeaseSchema,
			// activeLease: ActiveLeaseSchema.nullable(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

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
				furnishing: units.furnishing,
				createdAt: units.createdAt,
				updatedAt: units.updatedAt,
				deletedAt: units.deletedAt,
				propertyName: properties.name,
				ownerId: properties.ownerId,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(and(eq(units.id, input.id), isNull(units.deletedAt)))
			.limit(1);

		if (!result) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unit ${input.id} not found`,
			});
		}

		if (result.ownerId !== authUser.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "you don't have access to this unit",
			});
		}

		// Add active lease query
		const [activeLease] = await db
			.select({
				id: leases.id,
				tenantId: leases.tenantId,
				tenantName: user.name,
				tenantEmail: user.email,
				rent: leases.rent,
				startDate: leases.startDate,
				status: leases.status,
			})
			.from(leases)
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(and(eq(leases.unitId, input.id), eq(leases.status, "active")))
			.limit(1);

		const { ownerId: _, ...unitFields } = result;
		return {
			unit: {
				...unitFields,
				activeLease: activeLease ?? null,
			},
		};
	});

// 4) list
export const listUnits = ownerProcedure
	.route({ method: "GET", path: "/rent/unit/list" })
	.input(z.object({ propertyId: z.string().optional() }))
	.output(z.object({ units: z.array(UnitWithLeaseSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const whereClause = input.propertyId
			? and(
					eq(properties.ownerId, authUser.id),
					eq(units.propertyId, input.propertyId),
					isNull(units.deletedAt),
				)
			: and(eq(properties.ownerId, authUser.id), isNull(units.deletedAt));

		const rows = await db
			.select({
				id: units.id,
				propertyId: units.propertyId,
				unitNumber: units.unitNumber,
				type: units.type,
				area: units.area,
				baseRent: units.baseRent,
				furnishing: units.furnishing,
				description: units.description,
				status: units.status,
				createdAt: units.createdAt,
				updatedAt: units.updatedAt,
				deletedAt: units.deletedAt,
				// From properties join (ownership context)
				propertyName: properties.name,
				// Lease fields - all nullable (left Joins mean vacan units get nullable)
				leaseId: leases.id,
				leaseRent: leases.rent,
				leaseStartDate: leases.startDate,
				leaseStatus: leases.status,
				leaseTenantId: leases.tenantId,
				// Tenant fields -- also nullable
				tenantName: user.name,
				tenantEmail: user.email,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.leftJoin(
				leases,
				and(
					eq(leases.unitId, units.id),
					eq(leases.status, LEASE_STATUSES.ACTIVE),
				),
			)
			.leftJoin(user, eq(user.id, leases.tenantId))
			.where(whereClause)
			.orderBy(units.unitNumber);

		const result = rows.map((row) => ({
			id: row.id,
			propertyId: row.propertyId,
			unitNumber: row.unitNumber,
			type: row.type,
			area: row.area,
			baseRent: row.baseRent,
			description: row.description,
			status: row.status,
			furnishing: row.furnishing,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			deletedAt: row.deletedAt,
			propertyName: row.propertyName,
			activeLease: row.leaseId
				? {
						id: row.leaseId,
						tenantId: row.leaseTenantId as string,
						tenantName: row.tenantName,
						tenantEmail: row.tenantEmail,
						rent: row.leaseRent as number,
						startDate: row.leaseStartDate as Date,
						status:
							row.leaseStatus as (typeof LEASE_STATUSES)[keyof typeof LEASE_STATUSES],
					}
				: null,
		}));

		return { units: result };
	});

// 5) deleteUnit
export const deleteUnit = ownerProcedure
	.route({ method: "DELETE", path: "/rent/unit/delete" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.literal(true) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		await VerifyUnitOwnership(db, authUser.id, input.id);

		const activeLease = await db
			.select({ id: leases.id })
			.from(leases)
			.where(and(eq(leases.unitId, input.id), eq(leases.status, "active")))
			.limit(1);

		if (activeLease.length > 0) {
			throw new ORPCError("CONFLICT", {
				message:
					"Cannot delete a unit with an active lease,End the Lease First.",
			});
		}

		await db
			.update(units)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(units.id, input.id));

		return { success: true as const };
	});
