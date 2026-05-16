import { ORPCError } from "@orpc/client";
import { protectedProcedure } from "@rently/api/procedures";
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
export const createLease = protectedProcedure
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
			);

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

		if (!lease) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create lease",
			});
		}

		return { lease };
	});

// update
export const updateLease = protectedProcedure
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
export const getLeaseById = protectedProcedure
	.route({ method: "GET", path: "/rent/lease/get" })
	.input(z.object({ id: z.string() }))
	// .output(z.object({ lease: LeaseWithDetailsSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const [lease] = await db
			.select()
			.from(leases)
			.where(eq(leases.id, input.id));

		if (!lease) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: `Lease ${input.id} not found`,
			});
		}

		// Verify Ownership
		const ownership = await getLeaseWithOwner(db, input.id);
		if (!ownership || ownership?.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "you don't have access to this unit",
			});
		}

		return { lease };
	});

// getAll
export const listLease = protectedProcedure
	.route({ method: "GET", path: "/rent/lease/list" })
	// .input(z.object({ status: z.enum(LEASE_STATUSES).optional() }))
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
				tenantName: user.name,
				tenantEmail: user.email,
				tenantPhone: user.phone,
				unitNumber: units.unitNumber,
				unitId: leases.unitId,
				createdAt: leases.createdAt,
				updatedAt: leases.updatedAt,
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
export const deleteLease = protectedProcedure
	.route({ method: "DELETE", path: "/rent/unit/delete" })
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
		// get lease with unit info for ownership check and unit update
		const [leaseData] = await db
			.select({
				leaseId: leases.id,
				unitId: leases.unitId,
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(eq(leases.id, input.id))
			.limit(1);

		if (!leaseData) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Lease not found",
			});
		}

		if (leaseData.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You don't have permission to delete this lease",
			});
		}

		// transaction
		await db.transaction(async (tx) => {
			await tx.delete(leases).where(eq(leases.id, input.id));

			// Reset Unit to available
			await tx
				.update(units)
				.set({ status: "available", updatedAt: new Date() })
				.where(eq(units.id, leaseData.unitId));
		});
		return { success: true };
	});
