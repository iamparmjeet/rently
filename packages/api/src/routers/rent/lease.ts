import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { LEASE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	rentReminderSuppressions,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import {
	CreateLeaseSchema,
	LeaseSelectSchema,
	LeaseWithDetailsSchema,
	UpdateLeaseSchema,
} from "@rently/validators";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { getNextLocalPeriodKey } from "../helpers/rent-cycle";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

// Ownership helpers
// Lease -> Unit -> property -> ownerId

async function getLeaseWithOwner(db: Database, leaseId: string) {
	const [lease] = await db
		.select({
			leaseId: leases.id,
			unitId: leases.unitId,
			ownerId: properties.ownerId,
			status: leases.status,
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
			throw new ORPCError("FORBIDDEN", {
				message: "Unit not found or you do not own it",
			});
		}

		if (unit.status !== "available") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Unit is not available for lease",
			});
		}

		const [registeredTenant] = await db
			.select({ id: user.id })
			.from(user)
			.innerJoin(tenantProfiles, eq(tenantProfiles.userId, user.id))
			.where(
				and(
					eq(user.id, input.tenantId),
					eq(tenantProfiles.createdById, authUser.id),
				),
			)
			.limit(1);

		// Owner-prepared tenants are valid lease parties before accepting the invite.
		// Their invite ID becomes a stable provisional user ID so the existing lease
		// foreign key remains valid and acceptance can later claim the same identity.
		const [pendingTenant] = registeredTenant
			? []
			: await db
					.select({
						id: tenantInvites.id,
						name: tenantInvites.name,
						email: tenantInvites.email,
						phone: tenantInvites.phone,
						address: tenantInvites.address,
						emergencyContact: tenantInvites.emergencyContact,
						emergencyContactName: tenantInvites.emergencyContactName,
						emergencyContactLocation: tenantInvites.emergencyContactLocation,
					})
					.from(tenantInvites)
					.where(
						and(
							eq(tenantInvites.id, input.tenantId),
							eq(tenantInvites.invitedById, authUser.id),
							eq(tenantInvites.onboardingMode, "owner_prepared"),
							eq(tenantInvites.status, "pending"),
							isNull(tenantInvites.deletedAt),
						),
					)
					.limit(1);

		if (!registeredTenant && !pendingTenant) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Tenant is not available for this lease",
			});
		}

		const createLeaseQuery = db
			.insert(leases)
			.values({ ...input, status: "active" })
			.returning();
		const occupyUnitQuery = db
			.update(units)
			.set({ status: "occupied", updatedAt: new Date() })
			.where(eq(units.id, input.unitId));

		// Neon HTTP does not support callback transactions. Its batch API sends both
		// statements as one database transaction; node-postgres retains its normal
		// callback transaction path.
		let lease: Awaited<typeof createLeaseQuery>[number] | undefined;
		if (supportsBatch(db)) {
			if (pendingTenant) {
				const [, , createdLeases] = await db.batch([
					db.insert(user).values({
						id: pendingTenant.id,
						name: pendingTenant.name,
						email: pendingTenant.email.toLowerCase(),
						emailVerified: false,
						role: USER_ROLES.TENANT,
						phone: pendingTenant.phone,
					}),
					db.insert(tenantProfiles).values({
						userId: pendingTenant.id,
						email: pendingTenant.email.toLowerCase(),
						phone: pendingTenant.phone,
						address: pendingTenant.address,
						emergencyContact: pendingTenant.emergencyContact,
						emergencyContactName: pendingTenant.emergencyContactName,
						emergencyContactLocation: pendingTenant.emergencyContactLocation,
						invitedId: pendingTenant.id,
						createdById: authUser.id,
					}),
					createLeaseQuery,
					occupyUnitQuery,
				]);
				lease = createdLeases[0];
			} else {
				const [createdLeases] = await db.batch([
					createLeaseQuery,
					occupyUnitQuery,
				]);
				lease = createdLeases[0];
			}
		} else {
			lease = await db.transaction(async (tx) => {
				if (pendingTenant) {
					await tx.insert(user).values({
						id: pendingTenant.id,
						name: pendingTenant.name,
						email: pendingTenant.email.toLowerCase(),
						emailVerified: false,
						role: USER_ROLES.TENANT,
						phone: pendingTenant.phone,
					});
					await tx.insert(tenantProfiles).values({
						userId: pendingTenant.id,
						email: pendingTenant.email.toLowerCase(),
						phone: pendingTenant.phone,
						address: pendingTenant.address,
						emergencyContact: pendingTenant.emergencyContact,
						emergencyContactName: pendingTenant.emergencyContactName,
						emergencyContactLocation: pendingTenant.emergencyContactLocation,
						invitedId: pendingTenant.id,
						createdById: authUser.id,
					});
				}

				const [newLease] = await tx
					.insert(leases)
					.values({ ...input, status: "active" })
					.returning();

				await tx
					.update(units)
					.set({ status: "occupied", updatedAt: new Date() })
					.where(eq(units.id, input.unitId));

				return newLease;
			});
		}

		if (!lease) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create lease",
			});
		}

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
			throw new ORPCError("NOT_FOUND", {
				message: "Lease not found",
			});
		}

		if (ownership.ownerId !== authUser.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this lease",
			});
		}

		if (ownership.status === "active") {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Active leases cannot be edited. Terminate the lease and create a new one to make changes.",
			});
		}

		if (ownership.status === "terminated" || ownership.status === "expired") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Terminated or expired leases cannot be edited.",
			});
		}

		const unitStatus =
			input.data.status === "terminated" || input.data.status === "expired"
				? "available"
				: input.data.status === "active"
					? "occupied"
					: undefined;
		const updateLeaseQuery = db
			.update(leases)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(leases.id, input.id))
			.returning();

		// Neon HTTP does not support callback transactions. Use its batch API so the
		// lease and unit updates remain atomic in every database environment.
		let lease: Awaited<typeof updateLeaseQuery>[number] | undefined;
		if (supportsBatch(db)) {
			if (unitStatus) {
				const [updatedLeases] = await db.batch([
					updateLeaseQuery,
					db
						.update(units)
						.set({ status: unitStatus, updatedAt: new Date() })
						.where(eq(units.id, ownership.unitId)),
				]);
				lease = updatedLeases[0];
			} else {
				const [updatedLeases] = await db.batch([updateLeaseQuery]);
				lease = updatedLeases[0];
			}
		} else {
			lease = await db.transaction(async (tx) => {
				const [updated] = await tx
					.update(leases)
					.set({ ...input.data, updatedAt: new Date() })
					.where(eq(leases.id, input.id))
					.returning();

				if (!updated) return undefined;

				if (unitStatus) {
					await tx
						.update(units)
						.set({ status: unitStatus, updatedAt: new Date() })
						.where(eq(units.id, ownership.unitId));
				}

				return updated;
			});
		}

		if (!lease) {
			throw new ORPCError("NOT_FOUND", {
				message: "Lease not found",
			});
		}

		return { lease };
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
				notice: leases.notice,
				rentDueDate: leases.rentDueDate,
				description: leases.description,
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
			throw new ORPCError("NOT_FOUND", {
				message: `Lease ${input.id} not found`,
			});
		}

		if (result.ownerId !== authUser.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not have access to this lease",
			});
		}

		const { ownerId: _ownerId, ...lease } = result;

		return { lease };
	});

// getAll
export const listLeases = ownerProcedure
	.route({ method: "GET", path: "/rent/lease/list" })
	.input(z.object({ status: z.enum(LEASE_STATUS_VALUES).optional() }))
	.output(z.object({ leases: z.array(LeaseWithDetailsSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				leaseId: leases.id,
				rent: leases.rent,
				deposit: leases.deposit,
				startDate: leases.startDate,
				endDate: leases.endDate,
				status: leases.status,
				notice: leases.notice,
				rentDueDate: leases.rentDueDate,
				description: leases.description,
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
			.where(
				and(
					eq(properties.ownerId, authUser.id),
					input.status ? eq(leases.status, input.status) : undefined,
				),
			)
			.orderBy(sql`${leases.createdAt} desc`);

		return { leases: results };
	});

// remove
export const terminateLease = ownerProcedure
	.route({ method: "DELETE", path: "/rent/lease/delete" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const ownership = await getLeaseWithOwner(db, input.id);

		if (!ownership) {
			throw new ORPCError("NOT_FOUND", {
				message: "Lease not found",
			});
		}

		if (ownership.ownerId !== authUser.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this lease",
			});
		}

		const terminateLeaseQuery = db
			.update(leases)
			.set({ status: "terminated", updatedAt: new Date() })
			.where(eq(leases.id, input.id));
		const releaseUnitQuery = db
			.update(units)
			.set({ status: "available", updatedAt: new Date() })
			.where(eq(units.id, ownership.unitId));

		if (supportsBatch(db)) {
			await db.batch([terminateLeaseQuery, releaseUnitQuery]);
		} else {
			await db.transaction(async (tx) => {
				await tx
					.update(leases)
					.set({ status: "terminated", updatedAt: new Date() })
					.where(eq(leases.id, input.id));
				await tx
					.update(units)
					.set({ status: "available", updatedAt: new Date() })
					.where(eq(units.id, ownership.unitId));
			});
		}
		return { success: true };
	});

async function assertOwnedLeaseForReminder(
	db: Database,
	ownerId: string,
	leaseId: string,
	activeOnly = true,
) {
	const [lease] = await db
		.select({
			id: leases.id,
			status: leases.status,
			ownerId: properties.ownerId,
		})
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(leases.id, leaseId))
		.limit(1);

	if (!lease) {
		throw new ORPCError("NOT_FOUND", { message: "Lease not found" });
	}
	if (lease.ownerId !== ownerId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not own this lease",
		});
	}
	if (activeOnly && lease.status !== "active") {
		throw new ORPCError("BAD_REQUEST", {
			message: "Only active leases can have rent reminders",
		});
	}
}

export const suppressNextRentReminders = ownerProcedure
	.route({ method: "POST", path: "/rent/lease/reminders/suppress" })
	.input(z.object({ leaseId: z.string().min(1) }))
	.output(z.object({ periodKey: z.string(), suppressed: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		await assertOwnedLeaseForReminder(db, authUser.id, input.leaseId);
		const periodKey = getNextLocalPeriodKey(new Date());

		await db
			.insert(rentReminderSuppressions)
			.values({ ownerId: authUser.id, leaseId: input.leaseId, periodKey })
			.onConflictDoNothing({
				target: [
					rentReminderSuppressions.ownerId,
					rentReminderSuppressions.leaseId,
					rentReminderSuppressions.periodKey,
				],
			});

		return { periodKey, suppressed: true };
	});

export const getNextRentReminderSuppression = ownerProcedure
	.route({ method: "GET", path: "/rent/lease/reminders/suppress" })
	.input(z.object({ leaseId: z.string().min(1) }))
	.output(z.object({ periodKey: z.string(), suppressed: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		await assertOwnedLeaseForReminder(db, authUser.id, input.leaseId, false);
		const periodKey = getNextLocalPeriodKey(new Date());
		const [suppression] = await db
			.select({ id: rentReminderSuppressions.id })
			.from(rentReminderSuppressions)
			.where(
				and(
					eq(rentReminderSuppressions.ownerId, authUser.id),
					eq(rentReminderSuppressions.leaseId, input.leaseId),
					eq(rentReminderSuppressions.periodKey, periodKey),
				),
			)
			.limit(1);

		return { periodKey, suppressed: Boolean(suppression) };
	});

export const resumeNextRentReminders = ownerProcedure
	.route({ method: "DELETE", path: "/rent/lease/reminders/suppress" })
	.input(z.object({ leaseId: z.string().min(1) }))
	.output(z.object({ periodKey: z.string(), suppressed: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		await assertOwnedLeaseForReminder(db, authUser.id, input.leaseId);
		const periodKey = getNextLocalPeriodKey(new Date());

		await db
			.delete(rentReminderSuppressions)
			.where(
				and(
					eq(rentReminderSuppressions.ownerId, authUser.id),
					eq(rentReminderSuppressions.leaseId, input.leaseId),
					eq(rentReminderSuppressions.periodKey, periodKey),
				),
			);

		return { periodKey, suppressed: false };
	});
