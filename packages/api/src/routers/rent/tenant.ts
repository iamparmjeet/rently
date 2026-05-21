// packages/api/src/routers/rent/tenant.ts
import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import { auth } from "@rently/auth";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { env } from "@rently/env/server";
import {
	CreateTenantSchema,
	RemoveTenantSchema,
	TenantListItemSchema,
} from "@rently/validators";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";

// List tenants for this owner
export const listTenants = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant/list" })
	.output(z.object({ tenants: z.array(TenantListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		// Step 1: Get all active leases for those properties, with tenant + unit + property info
		const results = await db
			.select({
				tenantId: user.id,
				name: user.name,
				email: user.email,
				phone: user.phone,
				avatarUrl: user.image,
				leaseId: leases.id,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
				rent: leases.rent,
				endDate: leases.endDate,
				inviteStatus: leases.status,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(eq(properties.ownerId, authUser.id));

		// Step 2: Shape into TenantListItemSchema
		const tenants = results.map((row) => ({
			id: row.tenantId,
			name: row.name,
			email: row.email,
			phone: row.phone,
			avatarUrl: row.avatarUrl,
			status: "accepted" as const,
			currentLease: {
				id: row.leaseId,
				propertyName: row.propertyName,
				unitNumber: row.unitNumber,
				rent: row.rent,
				endDate: row.endDate ? row.endDate.toISOString() : null,
			},
		}));

		return { tenants };
	});

// 2) GetTenantsById
export const getTenantById = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ tenant: TenantListItemSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// verify this tenant has a lease on one of the owner's properties.
		const [result] = await db
			.select({
				tenantId: user.id,
				name: user.name,
				email: user.email,
				phone: user.phone,
				avatarUrl: user.image,
				leaseId: leases.id,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
				rent: leases.rent,
				endDate: leases.endDate,
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(eq(user.id, input.id))
			.limit(1);

		if (!result) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Tenant not found",
			});
		}

		if (result.ownerId !== authUser.id) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "You do not have acces to this tenant",
			});
		}

		return {
			tenant: {
				id: result.tenantId,
				name: result.name,
				email: result.email,
				phone: result.phone,
				avatarUrl: result.avatarUrl,
				status: "accepted" as const,
				currentLease: {
					id: result.leaseId,
					propertyName: result.propertyName,
					unitNumber: result.unitNumber,
					rent: result.rent,
					endDate: result.endDate ? result.endDate.toISOString() : null,
				},
			},
		};
	});

// 3) Owner Creates tenant directly
export const createTenant = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/tenant/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateTenantSchema)
	.output(z.object({ tenantId: z.string() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Check does a user with this email already exists
		const [existingUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, input.email))
			.limit(1);

		if (existingUser) {
			throw new ORPCError(StatusPhrase.CONFLICT, {
				message: "A user with this email already exists",
			});
		}

		// 1) Create user via better-auth
		const tempPassword = crypto.randomUUID();

		const signupResult = await auth.api.signUpEmail({
			body: {
				email: input.email,
				name: input.name,
				password: tempPassword,
				phone: input.phone,
				role: USER_ROLES.TENANT,
			},
		});

		if (!signupResult.user) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create tenant account.",
			});
		}

		const newUserId = signupResult.user.id;

		// Step2 - Create Tenant Profile + pseudo invite in a transaction
		// // If this fails, we have an orphaned user — log it for manual cleanup
		// TODO: implement compensating delete via auth.api.deleteUser when better-auth exposes it
		try {
			await db.transaction(async (tx) => {
				await tx.insert(tenantProfiles).values({
					id: generatedId(),
					userId: newUserId,
					phone: input.phone ?? null,
					address: input.address ?? null,
					emergencyContact: input.emergencyContact ?? null,
					emergencyContactName: input.emergencyContactName ?? null,
					emergencyContactLocation: input.emergencyContactLocation ?? null,
					uidNumber: input.uidNumber ?? null,
					panNumber: input.panNumber ?? null,
					createdbyId: authUser.id,
				});

				// Record this as an accepted invite so the tenant appears in listTenants
				await tx.insert(tenantInvites).values({
					id: generatedId(),
					email: input.email,
					name: input.name,
					phone: input.phone,
					token: crypto.randomUUID(),
					invitedById: authUser.id,
					status: "accepted",
				});
			});
		} catch (txError) {
			// Orphaned user warning — user row exists but no profile
			console.error(
				`[createTenant] Transaction failed for userId ${newUserId}. User row orphaned. Manual cleanup needed.`,
				txError,
			);
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to complete tenant setup. Please contact support.",
			});
		}

		// Step 3: Trigger password reset — this generates the setup link
		// better-auth's forgetPassword sends an email internally OR returns a token
		// depending on your config. We call it and send our own email.

		try {
			await auth.api.requestPasswordReset({
				body: {
					email: input.email,
					redirectTo: `${env.CORS_ORIGIN}/set-password`,
				},
			});
		} catch (emailError) {
			// Non-fatal: tenant exists, they can request a reset themselves
			console.error("[createTenant] forgetPassword call failed", emailError);
		}

		return {
			tenantId: newUserId,
		};
	});

// 4) Remove
// Does NOT delete user account
export const removeTenant = protectedProcedure
	.route({ method: "DELETE", path: "/rent/tenant/remove" })
	.input(RemoveTenantSchema)
	.output(z.object({ success: z.boolean(), leasesTerminated: z.number() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Find All active leases for this tenant on this owner's properties only
		const activeLeases = await db
			.select({
				leaseId: leases.id,
				unitId: leases.unitId,
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(leases.tenantId, input.tenantId),
					eq(properties.ownerId, authUser.id),
					eq(leases.status, "active"),
				),
			);

		if (activeLeases.length === 0) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "No active leases found for this tenant on your properties.",
			});
		}

		const leaseIds = activeLeases.map((lease) => lease.leaseId);
		const unitIds = activeLeases.map((l) => l.unitId);

		// Look up email before the transaction
		const [tenantUser] = await db
			.select({
				email: user.email,
			})
			.from(user)
			.where(eq(user.id, input.tenantId))
			.limit(1);

		await db.transaction(async (tx) => {
			// Terminate Leases
			await tx
				.update(leases)
				.set({ status: "terminated", updatedAt: new Date() })
				.where(inArray(leases.id, leaseIds));

			// Free up units
			await tx
				.update(units)
				.set({ status: "available", updatedAt: new Date() })
				.where(inArray(units.id, unitIds));

			// Mark Invite as expired so they don't appear in pending invite list
			if (tenantUser?.email) {
				await tx
					.update(tenantInvites)
					.set({ status: "expired", updatedAt: new Date() })
					.where(and(eq(tenantInvites.email, tenantUser.email)));
			}
		});

		return {
			success: true,
			leasesTerminated: leaseIds.length,
		};
	});
