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
	AgreementSelectSchema,
	CreateCombinedLeaseSchema,
	CreateLeaseSchema,
	LeaseSelectSchema,
	LeaseWithDetailsSchema,
	UpdateAgreementSchema,
	UpdateLeaseSchema,
} from "@rently/validators";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import z from "zod";
import { getNextLocalPeriodKey } from "../helpers/rent-cycle";
import { ensureAccruedChargesSql } from "../helpers/rent-period";
import {
	assertTenantSeatSql,
	isTenantPlanLimitError,
	tenantPlanLimitError,
} from "../helpers/tenant-limit";

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
			tenantId: leases.tenantId,
			ownerId: properties.ownerId,
			status: leases.status,
			startDate: leases.startDate,
			endDate: leases.endDate,
			agreementId: leases.agreementId,
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

		// Verify user owns the units before allowing lease creation.
		// E08: archived units/properties are historical-only — no new leases.
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
				and(
					eq(units.id, input.unitId),
					eq(properties.ownerId, authUser.id),
					isNull(units.deletedAt),
					isNull(properties.deletedAt),
				),
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

		const leaseId = generatedId();
		const leaseValues = {
			...input,
			id: leaseId,
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
		try {
			if (supportsBatch(db)) {
				if (pendingTenant) {
					const [, , , , createdLeases] = await db.batch([
						// D04: seat check first — a raise here aborts the whole batch.
						db.execute(assertTenantSeatSql(authUser.id, input.tenantId)),
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
					const [, , createdLeases] = await db.batch([
						// D04: seat check first — a raise here aborts the whole batch.
						db.execute(assertTenantSeatSql(authUser.id, input.tenantId)),
						createAgreementQuery,
						createLeaseQuery,
						occupyUnitQuery,
						// C04 dual-write: accrue the new lease's period charges
						// immediately (R13 — a backdated start owes elapsed periods).
						db.execute(ensureAccruedChargesSql({ leaseId })),
					]);
					lease = createdLeases[0];
				}
			} else {
				lease = await db.transaction(async (tx) => {
					// D04: seat check first — a raise rolls the transaction back.
					await tx.execute(assertTenantSeatSql(authUser.id, input.tenantId));

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

					// C04 dual-write: accrue the new lease's period charges
					// immediately (R13 — a backdated start owes elapsed periods).
					await tx.execute(ensureAccruedChargesSql({ leaseId }));

					return newLease;
				});
			}
		} catch (error) {
			if (isTenantPlanLimitError(error)) {
				throw await tenantPlanLimitError(db, authUser.id);
			}
			throw error;
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
				and(
					inArray(units.id, unitIds),
					eq(properties.ownerId, authUser.id),
					isNull(units.deletedAt),
					isNull(properties.deletedAt),
				),
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
		const leaseIds = input.units.map(() => generatedId());
		const leaseInserts = input.units.map((unit, index) => {
			const leaseId = leaseIds[index];
			return db.insert(leases).values({
				id: leaseId,
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
			});
		});
		const occupyUnits = unitIds.map((unitId) =>
			db
				.update(units)
				.set({ status: "occupied", updatedAt: new Date() })
				.where(and(eq(units.id, unitId), eq(units.status, "available"))),
		);

		// C04 dual-write: accrue every new lease's period charges immediately
		// (R13 — a backdated start owes elapsed periods).
		const accrueNewLeases = leaseIds.map((leaseId) =>
			db.execute(ensureAccruedChargesSql({ leaseId })),
		);

		try {
			if (supportsBatch(db)) {
				await db.batch([
					// D04: one tenant per combined agreement — a single seat check
					// covers every unit; a raise aborts the whole batch.
					db.execute(assertTenantSeatSql(authUser.id, input.tenantId)),
					agreement,
					...leaseInserts,
					...occupyUnits,
					...accrueNewLeases,
				]);
			} else {
				await db.transaction(async (tx) => {
					// D04: seat check first — a raise rolls the transaction back.
					await tx.execute(assertTenantSeatSql(authUser.id, input.tenantId));

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
						input.units.map((unit, index) => ({
							id: leaseIds[index],
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
					for (const leaseId of leaseIds) {
						await tx.execute(ensureAccruedChargesSql({ leaseId }));
					}
				});
			}
		} catch (error) {
			if (isTenantPlanLimitError(error)) {
				throw await tenantPlanLimitError(db, authUser.id);
			}
			throw error;
		}

		const createdLeases = await db
			.select()
			.from(leases)
			.where(eq(leases.agreementId, agreementId));
		try {
			// F01: every notification read path is owner-only and the tenant app
			// has no notification surface, so a tenant-addressed row would be
			// visible to nobody. Address the record to the acting owner.
			await db.insert(notifications).values({
				userId: authUser.id,
				type: "combined_agreement_created",
				title: "Combined lease agreement created",
				message: `Combined agreement created covering ${createdLeases.length} units.`,
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

		// Expired leases are immutable. A terminated lease may only be reactivated;
		// its historical terms remain closed to ordinary edits.
		if (
			ownership.status === "expired" ||
			(ownership.status === "terminated" && input.data.status !== "active")
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					ownership.status === "expired"
						? "Expired leases cannot be edited."
						: "Terminated leases can only be reactivated.",
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

		// E06: reactivation is status-only. A terminated→active transition
		// must not rewrite rent, deposit, dates, or references on a closed
		// lease — those terms price already-recorded history.
		const reactivating =
			input.data.status === "active" && ownership.status !== "active";
		if (
			reactivating &&
			(input.data.rent !== undefined ||
				input.data.deposit !== undefined ||
				input.data.startDate !== undefined ||
				input.data.endDate !== undefined ||
				input.data.referenceId !== undefined)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Reactivation cannot change lease terms.",
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

		// Partial updates carry only the patch — validate merged dates so a
		// shrunken end date fails here, not at the database constraint.
		// Explicit null clears the end date (open-ended lease).
		const finalEnd =
			input.data.endDate === undefined ? ownership.endDate : input.data.endDate;
		const finalStart = input.data.startDate ?? ownership.startDate;
		if (finalEnd && finalStart && finalEnd < finalStart) {
			throw new ORPCError("BAD_REQUEST", {
				message: "End date must be after start date",
			});
		}

		const unitStatus =
			input.data.status === "terminated" || input.data.status === "expired"
				? "available"
				: input.data.status === "active"
					? "occupied"
					: undefined;
		// E05: shared agreement terms belong to the parent. A date patch on a
		// lease with siblings would diverge that child from the agreement, so
		// it must go through updateAgreement instead. A single-child
		// (independent) agreement propagates the dates to the parent in the
		// same atomic operation below; agreement-less legacy rows are
		// untouched by this rule.
		const editsSharedDates =
			input.data.startDate !== undefined || input.data.endDate !== undefined;
		let propagateAgreementDates = false;
		if (editsSharedDates && ownership.agreementId) {
			const siblings = await db
				.select({ id: leases.id })
				.from(leases)
				.where(eq(leases.agreementId, ownership.agreementId));
			if (siblings.length > 1) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Shared agreement terms cannot be changed on one lease. Update the agreement instead.",
				});
			}
			propagateAgreementDates = true;
		}
		const agreementDatePatch = propagateAgreementDates
			? {
					...(input.data.startDate !== undefined
						? { startDate: input.data.startDate }
						: {}),
					...(input.data.endDate !== undefined
						? { endDate: input.data.endDate }
						: {}),
				}
			: null;
		// D04: a reactivation is an activation — the tenant consumes a seat
		// unless they already hold another active lease under this owner.
		// (E06 defines `reactivating` with the guards above; reuse it here.)

		const updateLeaseQuery = db
			.update(leases)
			.set({ ...input.data, updatedAt: new Date() })
			.where(eq(leases.id, input.id))
			.returning();

		// E05: appended last so the existing positional destructuring below is
		// unaffected. A raise here aborts the whole batch/transaction.
		const propagateAgreementQuery =
			agreementDatePatch && ownership.agreementId
				? db
						.update(leaseAgreements)
						.set({ ...agreementDatePatch, updatedAt: new Date() })
						.where(eq(leaseAgreements.id, ownership.agreementId))
				: null;

		// Neon HTTP does not support callback transactions. Use its batch API so the
		// lease and unit updates remain atomic in every database environment.
		let lease: Awaited<typeof updateLeaseQuery>[number] | undefined;
		try {
			if (supportsBatch(db)) {
				if (unitStatus) {
					const unitStatusQuery = db
						.update(units)
						.set({ status: unitStatus, updatedAt: new Date() })
						.where(eq(units.id, ownership.unitId));
					if (reactivating) {
						// D04: seat check first — a raise aborts the batch.
						const [, updatedLeases] = await db.batch([
							db.execute(assertTenantSeatSql(authUser.id, ownership.tenantId)),
							updateLeaseQuery,
							unitStatusQuery,
							...(propagateAgreementQuery ? [propagateAgreementQuery] : []),
						]);
						lease = updatedLeases[0];
					} else {
						const [updatedLeases] = await db.batch([
							updateLeaseQuery,
							unitStatusQuery,
							...(propagateAgreementQuery ? [propagateAgreementQuery] : []),
						]);
						lease = updatedLeases[0];
					}
				} else {
					const [updatedLeases] = await db.batch([
						updateLeaseQuery,
						...(propagateAgreementQuery ? [propagateAgreementQuery] : []),
					]);
					lease = updatedLeases[0];
				}
			} else {
				lease = await db.transaction(async (tx) => {
					if (reactivating) {
						// D04: seat check first — a raise rolls the transaction back.
						await tx.execute(
							assertTenantSeatSql(authUser.id, ownership.tenantId),
						);
					}

					const [updated] = await tx
						.update(leases)
						.set({ ...input.data, updatedAt: new Date() })
						.where(eq(leases.id, input.id))
						.returning();

					if (!updated) return undefined;

					if (agreementDatePatch && ownership.agreementId) {
						await tx
							.update(leaseAgreements)
							.set({ ...agreementDatePatch, updatedAt: new Date() })
							.where(eq(leaseAgreements.id, ownership.agreementId));
					}

					if (unitStatus) {
						await tx
							.update(units)
							.set({ status: unitStatus, updatedAt: new Date() })
							.where(eq(units.id, ownership.unitId));
					}

					return updated;
				});
			}
		} catch (error) {
			if (isTenantPlanLimitError(error)) {
				throw await tenantPlanLimitError(db, authUser.id);
			}
			throw error;
		}

		if (!lease) {
			throw new ORPCError("NOT_FOUND", {
				message: "Lease not found",
			});
		}

		return { lease };
	});

// E05: update shared agreement terms on the parent and every child together.
// One child can no longer change shared terms independently (updateLease
// refuses that); this is the only path for combined agreements.
export const updateAgreement = ownerProcedure
	.route({ method: "PATCH", path: "/rent/lease-agreement/update" })
	.input(z.object({ id: z.string(), data: UpdateAgreementSchema }))
	.output(
		z.object({
			agreement: AgreementSelectSchema,
			leases: z.array(LeaseSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const [agreement] = await db
			.select({
				id: leaseAgreements.id,
				ownerId: properties.ownerId,
				startDate: leaseAgreements.startDate,
				endDate: leaseAgreements.endDate,
			})
			.from(leaseAgreements)
			.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
			.where(
				and(eq(leaseAgreements.id, input.id), isNull(properties.deletedAt)),
			)
			.limit(1);

		if (!agreement) {
			throw new ORPCError("NOT_FOUND", {
				message: "Agreement not found",
			});
		}

		if (agreement.ownerId !== authUser.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this agreement",
			});
		}

		// Partial updates carry only the patch — validate merged dates so a
		// shrunken end date fails here, not at the database constraint.
		// Explicit null clears the end date (open-ended agreement).
		const finalEnd =
			input.data.endDate === undefined ? agreement.endDate : input.data.endDate;
		const finalStart = input.data.startDate ?? agreement.startDate;
		if (finalEnd && finalStart && finalEnd < finalStart) {
			throw new ORPCError("BAD_REQUEST", {
				message: "End date must be after start date",
			});
		}

		// Defined keys only — an absent key leaves parent and children as-is,
		// an explicit null clears the nullable columns on both.
		const { ...patch } = input.data;
		const sharedPatch = Object.fromEntries(
			Object.entries(patch).filter(([, value]) => value !== undefined),
		);

		const updateAgreementQuery = db
			.update(leaseAgreements)
			.set({ ...sharedPatch, updatedAt: new Date() })
			.where(eq(leaseAgreements.id, input.id))
			.returning();
		const updateChildrenQuery = db
			.update(leases)
			.set({ ...sharedPatch, updatedAt: new Date() })
			.where(eq(leases.agreementId, input.id))
			.returning();

		// Neon HTTP does not support callback transactions — batch both writes
		// so parent and children stay in sync in every database environment.
		let updatedAgreement:
			| Awaited<typeof updateAgreementQuery>[number]
			| undefined;
		let updatedChildren: Awaited<typeof updateChildrenQuery>[number][];
		if (supportsBatch(db)) {
			const [agreements, children] = await db.batch([
				updateAgreementQuery,
				updateChildrenQuery,
			]);
			updatedAgreement = agreements[0];
			updatedChildren = [...children].sort((a, b) =>
				a.unitId.localeCompare(b.unitId),
			);
		} else {
			const result = await db.transaction(async (tx) => {
				const [parent] = await tx
					.update(leaseAgreements)
					.set({ ...sharedPatch, updatedAt: new Date() })
					.where(eq(leaseAgreements.id, input.id))
					.returning();
				if (!parent) return undefined;
				const children = await tx
					.update(leases)
					.set({ ...sharedPatch, updatedAt: new Date() })
					.where(eq(leases.agreementId, input.id))
					.returning();
				return { parent, children };
			});
			if (!result) {
				throw new ORPCError("NOT_FOUND", {
					message: "Agreement not found",
				});
			}
			updatedAgreement = result.parent;
			updatedChildren = [...result.children].sort((a, b) =>
				a.unitId.localeCompare(b.unitId),
			);
		}

		if (!updatedAgreement) {
			throw new ORPCError("NOT_FOUND", {
				message: "Agreement not found",
			});
		}

		return { agreement: updatedAgreement, leases: updatedChildren };
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
