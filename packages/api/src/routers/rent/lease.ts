import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import {
	LEASE_AGREEMENT_ARRANGEMENT,
	LEASE_CATEGORY,
	LEASE_STATUS_VALUES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	notifications,
	properties,
	rentReminderSuppressions,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import {
	CreateCombinedLeaseSchema,
	CreateLeaseSchema,
	LeaseSelectSchema,
	LeaseWithDetailsSchema,
	UpdateLeaseSchema,
} from "@rently/validators";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
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
		.where(
			and(
				eq(leases.id, leaseId),
				isNull(properties.deletedAt),
				isNull(units.deletedAt),
			),
		);

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
				type: units.type,
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
					isNull(tenantProfiles.deletedAt),
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

		const agreementId = generatedId();

		const agreementValues = {
			id: agreementId,
			tenantId: input.tenantId,
			propertyId: unit.propertyId,
			arrangementType: LEASE_AGREEMENT_ARRANGEMENT.INDEPENDENT,
			category:
				unit.type === UNIT_TYPES.SHOP
					? LEASE_CATEGORY.COMMERCIAL
					: LEASE_CATEGORY.RESIDENTIAL,
			startDate: input.startDate,
			endDate: input.endDate,
			rentDueDate: input.rentDueDate,
			notice: input.notice,
			description: input.description,
		};

		const leaseValues = {
			...input,
			agreementId,
			status: "active" as const,
		};

		const createAgreementQuery = db
			.insert(leaseAgreements)
			.values(agreementValues);
		const createLeaseQuery = db.insert(leases).values(leaseValues).returning();
		const occupyUnitQuery = db
			.update(units)
			.set({ status: "occupied", updatedAt: new Date() })
			.where(and(eq(units.id, input.unitId), eq(units.status, "available")));

		// Neon HTTP does not support callback transactions. Its batch API sends both
		// statements as one database transaction; node-postgres retains its normal
		// callback transaction path.
		let lease: Awaited<typeof createLeaseQuery>[number] | undefined;
		if (supportsBatch(db)) {
			if (pendingTenant) {
				const [, , , createdLeases] = await db.batch([
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
					createAgreementQuery,
					createLeaseQuery,
					occupyUnitQuery,
				]);
				lease = createdLeases[0];
			} else {
				const [, createdLeases] = await db.batch([
					createAgreementQuery,
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

				await tx.insert(leaseAgreements).values(agreementValues);

				const [newLease] = await tx
					.insert(leases)
					.values(leaseValues)
					.returning();

				await tx
					.update(units)
					.set({ status: "occupied", updatedAt: new Date() })
					.where(
						and(eq(units.id, input.unitId), eq(units.status, "available")),
					);

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

export const createCombinedLease = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/lease/create-combined",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateCombinedLeaseSchema)
	.output(z.object({ leases: z.array(LeaseSelectSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		const unitIds = input.units.map((unit) => unit.unitId);
		const selectedUnits = await db
			.select({
				id: units.id,
				propertyId: units.propertyId,
				status: units.status,
				type: units.type,
			})
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(inArray(units.id, unitIds), eq(properties.ownerId, authUser.id)),
			);

		if (selectedUnits.length !== unitIds.length) {
			throw new ORPCError("FORBIDDEN", {
				message: "One or more units are not yours or do not exist",
			});
		}
		if (selectedUnits.some((unit) => unit.status !== "available")) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Every unit must be available for a combined lease",
			});
		}

		const propertyIds = new Set(selectedUnits.map((unit) => unit.propertyId));
		const categories = new Set(
			selectedUnits.map((unit) =>
				unit.type === UNIT_TYPES.SHOP
					? LEASE_CATEGORY.COMMERCIAL
					: LEASE_CATEGORY.RESIDENTIAL,
			),
		);
		if (propertyIds.size !== 1 || categories.size !== 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Combined leases must use one property and one category",
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
					isNull(tenantProfiles.deletedAt),
				),
			)
			.limit(1);
		if (!registeredTenant) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Tenant is not available for this lease",
			});
		}

		const agreementId = generatedId();
		const propertyId = selectedUnits[0]?.propertyId;
		const category = [...categories][0];
		if (!propertyId || !category) throw new ORPCError("INTERNAL_SERVER_ERROR");

		const agreement = db.insert(leaseAgreements).values({
			id: agreementId,
			tenantId: input.tenantId,
			propertyId,
			arrangementType: LEASE_AGREEMENT_ARRANGEMENT.COMBINED,
			category,
			startDate: input.startDate,
			endDate: input.endDate,
			rentDueDate: input.rentDueDate,
			notice: input.notice,
			description: input.description,
		});
		const leaseInserts = input.units.map((unit) =>
			db.insert(leases).values({
				unitId: unit.unitId,
				tenantId: input.tenantId,
				startDate: input.startDate,
				endDate: input.endDate,
				rent: unit.rent,
				deposit: unit.deposit ?? null,
				status: "active",
				notice: input.notice,
				rentDueDate: input.rentDueDate,
				description: input.description,
				agreementId,
			}),
		);
		const occupyUnits = unitIds.map((unitId) =>
			db
				.update(units)
				.set({ status: "occupied", updatedAt: new Date() })
				.where(and(eq(units.id, unitId), eq(units.status, "available"))),
		);

		if (supportsBatch(db)) {
			await db.batch([agreement, ...leaseInserts, ...occupyUnits]);
		} else {
			await db.transaction(async (tx) => {
				await tx.insert(leaseAgreements).values({
					id: agreementId,
					tenantId: input.tenantId,
					propertyId,
					arrangementType: LEASE_AGREEMENT_ARRANGEMENT.COMBINED,
					category,
					startDate: input.startDate,
					endDate: input.endDate,
					rentDueDate: input.rentDueDate,
					notice: input.notice,
					description: input.description,
				});
				await tx.insert(leases).values(
					input.units.map((unit) => ({
						unitId: unit.unitId,
						tenantId: input.tenantId,
						startDate: input.startDate,
						endDate: input.endDate,
						rent: unit.rent,
						deposit: unit.deposit ?? null,
						status: "active" as const,
						notice: input.notice,
						rentDueDate: input.rentDueDate,
						description: input.description,
						agreementId,
					})),
				);
				for (const unitId of unitIds) {
					await tx
						.update(units)
						.set({ status: "occupied", updatedAt: new Date() })
						.where(and(eq(units.id, unitId), eq(units.status, "available")));
				}
			});
		}

		const createdLeases = await db
			.select()
			.from(leases)
			.where(eq(leases.agreementId, agreementId));
		try {
			await db.insert(notifications).values({
				userId: input.tenantId,
				type: "combined_agreement_created",
				title: "Combined lease agreement created",
				message:
					"Your landlord created a combined agreement covering multiple units.",
				entityId: agreementId,
				entityType: "lease_agreement",
			});
		} catch (error) {
			console.error("[lease:createCombinedLease] notification failed", {
				agreementId,
				error,
			});
		}
		return { leases: createdLeases };
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

		// Active leases are editable (rent, deposit, notice, description, dates).
		// Only terminated/expired are immutable — they represent closed periods.
		if (ownership.status === "terminated" || ownership.status === "expired") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Terminated or expired leases cannot be edited.",
			});
		}

		// Financial terms are immutable once a lease is active — changing rent or
		// deposit would silently reprice already-recorded payments.
		if (
			ownership.status === "active" &&
			(input.data.rent !== undefined || input.data.deposit !== undefined)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Rent and deposit cannot be changed on an active lease.",
			});
		}

		// Reactivating a non-active lease must not evict a unit that is already
		// occupied by another active lease.
		if (input.data.status === "active" && ownership.status !== "active") {
			const [conflicting] = await db
				.select({ id: leases.id })
				.from(leases)
				.where(
					and(
						eq(leases.unitId, ownership.unitId),
						eq(leases.status, "active"),
						ne(leases.id, input.id),
					),
				)
				.limit(1);
			if (conflicting) {
				throw new ORPCError("CONFLICT", {
					message: "Unit already has an active lease.",
				});
			}
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
				agreementId: leases.agreementId,
				// for auth check only — stripped by output schema
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(leases.id, input.id),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			)
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
				agreementId: leases.agreementId,
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
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
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

		// Idempotent terminate: a second terminate must not release a unit that a
		// newer lease has since occupied.
		if (ownership.status === "terminated") {
			return { success: true };
		}

		const terminateLeaseQuery = db
			.update(leases)
			.set({ status: "terminated", updatedAt: new Date() })
			.where(and(eq(leases.id, input.id), ne(leases.status, "terminated")));
		// Release the unit only if no other active lease still occupies it — a
		// stale second terminate must not evict a newer lease on the same unit.
		const releaseUnitQuery = db
			.update(units)
			.set({ status: "available", updatedAt: new Date() })
			.where(
				and(
					eq(units.id, ownership.unitId),
					sql`not exists (
						select 1 from ${leases} other
						where other.unit_id = ${units.id}
						  and other.status = 'active'
						  and other.id <> ${input.id}
					)`,
				),
			);

		if (supportsBatch(db)) {
			await db.batch([terminateLeaseQuery, releaseUnitQuery]);
		} else {
			await db.transaction(async (tx) => {
				await tx
					.update(leases)
					.set({ status: "terminated", updatedAt: new Date() })
					.where(and(eq(leases.id, input.id), ne(leases.status, "terminated")));
				await tx
					.update(units)
					.set({ status: "available", updatedAt: new Date() })
					.where(
						and(
							eq(units.id, ownership.unitId),
							sql`not exists (
								select 1 from ${leases} other
								where other.unit_id = ${units.id}
								  and other.status = 'active'
								  and other.id <> ${input.id}
							)`,
						),
					);
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
		.where(
			and(
				eq(leases.id, leaseId),
				isNull(properties.deletedAt),
				isNull(units.deletedAt),
			),
		)
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
