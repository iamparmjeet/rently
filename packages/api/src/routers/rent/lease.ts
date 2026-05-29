import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { leases, properties, units } from "@rently/db/schema/schema";
import {
	CreateLeaseSchema,
	LeaseSelectSchema,
	LeaseWithDetailsSchema,
	UpdateLeaseSchema,
} from "@rently/validators";
import { and, eq, sql } from "drizzle-orm";
import z from "zod";

// Ownership helpers
// Lease -> Unit -> property -> ownerId

async function getLeaseWithOwner(db: Database, leaseId: string) {
	const [lease] = await db
		.select({
			leaseId: leases.id,
			unitId: leases.unitId,
			ownerId: properties.ownerId,
		})
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(leases.id, leaseId));

	return lease ?? null;
}

//create
export const createLease = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/lease/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateLeaseSchema)
	.output(z.object({ lease: LeaseSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Verify user owns the units before allowing lease creation
		const [unit] = await db
			.select({
				unitId: units.id,
				status: units.status,
				propertyId: units.propertyId,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(eq(units.id, input.unitId), eq(properties.ownerId, authUser.id)),
			)
			.limit(1);

		if (!unit) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "Unit not found or you do not own it",
			});
		}

		if (unit.status !== "available") {
			throw new ORPCError(StatusPhrase.BAD_REQUEST, {
				message: "Unit is not available for lease",
			});
		}

		// Transaction - Both ops succeed or both fail
		const lease = await db.transaction(async (tx) => {
			const [newLease] = await tx
				.insert(leases)
				.values({
					...input,
					status: "active",
				})
				.returning();

			if (!newLease) {
				throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
					message: "Failed to create lease",
				});
			}

			// update unit status to occupied
			await tx
				.update(units)
				.set({ status: "occupied", updatedAt: new Date() })
				.where(eq(units.id, input.unitId));

			return newLease;
		});

		return { lease };
	});

// update
export const updateLease = ownerProcedure
	.route({ method: "PATCH", path: "/rent/lease/update" })
	.input(z.object({ id: z.string(), data: UpdateLeaseSchema }))
	.output(z.object({ lease: LeaseSelectSchema })) // Not required
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Verfiy ownership
		const ownership = await getLeaseWithOwner(db, input.id);

		if (!ownership) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Lease not found",
			});
		}

		if (ownership.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not own this lease",
			});
		}

		const [updated] = await db
			.update(leases)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(leases.id, input.id))
			.returning();

		if (!updated) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Lease not found",
			});
		}

		return { lease: updated };
	});

// getbyId
export const getLeaseById = ownerProcedure
	.route({ method: "GET", path: "/rent/lease/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ lease: LeaseSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const [result] = await db
			.select({
				id: leases.id,
				unitId: leases.unitId,
				tenantId: leases.tenantId,
				startDate: leases.startDate,
				endDate: leases.endDate,
				rent: leases.rent,
				deposit: leases.deposit,
				status: leases.status,
				referenceId: leases.referenceId,
				createdAt: leases.createdAt,
				updatedAt: leases.updatedAt,
				// for auth check only — stripped by output schema
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(eq(leases.id, input.id))
			.limit(1);

		if (!result) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: `Lease ${input.id} not found`,
			});
		}

		if (result.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not have access to this lease",
			});
		}

		const { ownerId: _ownerId, ...lease } = result;

		return { lease };
	});

// getAll
export const listLeases = ownerProcedure
	.route({ method: "GET", path: "/rent/lease/list" })
	.output(z.object({ leases: z.array(LeaseWithDetailsSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				leaseId: leases.id,
				rent: leases.rent,
				deposit: leases.deposit,
				startDate: leases.startDate,
				endDate: leases.endDate,
				status: leases.status,
				createdAt: leases.createdAt,
				updatedAt: leases.updatedAt,
				tenantId: leases.tenantId,
				tenantName: user.name,
				tenantEmail: user.email,
				tenantPhone: user.phone,
				unitNumber: units.unitNumber,
				unitId: leases.unitId,
				propertyName: properties.name,
				propertyId: properties.id,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(eq(properties.ownerId, authUser.id))
			.orderBy(sql`${leases.createdAt} desc`);

		return { leases: results };
	});

// remove
export const deleteLease = ownerProcedure
	.route({ method: "DELETE", path: "/rent/lease/delete" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const ownership = await getLeaseWithOwner(db, input.id);

		if (!ownership) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Lease not found",
			});
		}

		if (ownership.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not own this lease",
			});
		}

		// transaction
		await db.transaction(async (tx) => {
			await tx.delete(leases).where(eq(leases.id, input.id));

			// Reset Unit to available
			await tx
				.update(units)
				.set({ status: "available", updatedAt: new Date() })
				.where(eq(units.id, ownership.unitId));
		});
		return { success: true };
	});
