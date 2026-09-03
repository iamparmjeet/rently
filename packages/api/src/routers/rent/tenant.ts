import { ORPCError } from "@orpc/server";
import { isNonLiveWorkspace } from "@rently/api/modules/sample-workspace";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import { auth } from "@rently/auth";
import { supportsDatabaseBatch } from "@rently/db";

import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { sendCustomEmailToTenant } from "@rently/email";
import { env } from "@rently/env/server";
import {
	CreateTenantSchema,
	InvitePublicSchema,
	RemoveTenantSchema,
	TenantDetailSchema,
	type TenantLeaseSummary,
	TenantListItemSchema,
	UpdateTenantProfileSchema,
} from "@rently/validators";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import z from "zod";
import { queryOverdueLeases } from "../helpers/overdue-query";
import { createPendingTenantInvite } from "./invite-service";

// List tenants for this owner
export const listTenants = ownerProcedure
	.route({ method: "GET", path: "/rent/tenant/list" })
	.output(z.object({ tenants: z.array(TenantListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		// ✅ Start from tenantProfiles — the owner anchor
		// LEFT JOIN leases so tenants without leases still appear
		// LEFT JOIN units + properties only if a lease exists
		const results = await db
			.select({
				tenantId: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				phone: user.phone,
				avatarUrl: user.image,
				inviteId: tenantProfiles.invitedId,
				inviteStatus: tenantInvites.status,
				leaseId: leases.id, // nullable — no lease = null
				propertyName: properties.name, // nullable — no lease = null
				unitNumber: units.unitNumber, // nullable — no lease = null
				rent: leases.rent, // nullable — no lease = null
				endDate: leases.endDate, // nullable
				leaseStatus: leases.status, // nullable — used to derive tenant status
				createdAt: tenantProfiles.createdAt,
				updatedAt: tenantProfiles.updatedAt,
			})
			.from(tenantProfiles)
			.innerJoin(user, eq(tenantProfiles.userId, user.id))
			.leftJoin(tenantInvites, eq(tenantProfiles.invitedId, tenantInvites.id))
			// LEFT JOIN: keep the tenant row even if no matching lease exists
			.leftJoin(
				leases,
				and(eq(leases.tenantId, user.id), eq(leases.status, "active")),
			)
			// These two are conditional on leases existing — also LEFT JOIN
			.leftJoin(units, eq(leases.unitId, units.id))
			.leftJoin(properties, eq(units.propertyId, properties.id))
			// Ownership check: this owner created this tenant
			.where(
				and(
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.orderBy(desc(leases.startDate));

		const tenantMap = new Map<string, z.infer<typeof TenantListItemSchema>>();

		for (const row of results) {
			const lease: TenantLeaseSummary | null = row.leaseId
				? {
						id: row.leaseId,
						propertyName: row.propertyName ?? "",
						unitNumber: row.unitNumber ?? "",
						rent: row.rent ?? 0,
						endDate: row.endDate ? row.endDate.toISOString() : null,
						overdue: null,
					}
				: null;

			if (!tenantMap.has(row.tenantId)) {
				tenantMap.set(row.tenantId, {
					id: row.tenantId,
					inviteId: row.inviteStatus === "pending" ? row.inviteId : null,
					name: row.name,
					email: row.email,
					emailVerified: row.emailVerified,
					phone: row.phone,
					avatarUrl: row.avatarUrl,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					status: row.inviteStatus ?? ("accepted" as const),
					activeLeases: lease ? [lease] : [],
					currentLease: lease,
				});
			} else if (lease) {
				tenantMap.get(row.tenantId)?.activeLeases.push(lease);
			}
		}

		// A tenant has no user/profile until they accept the invitation. Include
		// those owner-created records here too, otherwise a newly added tenant
		// disappears from the dashboard until they finish onboarding.
		const pendingInvites = await db
			.select({
				id: tenantInvites.id,
				name: tenantInvites.name,
				email: tenantInvites.email,
				phone: tenantInvites.phone,
				status: tenantInvites.status,
				createdAt: tenantInvites.createdAt,
				updatedAt: tenantInvites.updatedAt,
			})
			.from(tenantInvites)
			.where(
				and(
					eq(tenantInvites.invitedById, authUser.id),
					eq(tenantInvites.status, "pending"),
					isNull(tenantInvites.deletedAt),
				),
			)
			.orderBy(desc(tenantInvites.createdAt));

		for (const invite of pendingInvites) {
			if (invite.status === "accepted" || tenantMap.has(invite.id)) continue;

			tenantMap.set(invite.id, {
				id: invite.id,
				inviteId: invite.id,
				name: invite.name,
				email: invite.email,
				emailVerified: false,
				phone: invite.phone,
				avatarUrl: null,
				status: invite.status,
				createdAt: invite.createdAt,
				updatedAt: invite.updatedAt,
				activeLeases: [],
				currentLease: null,
			});
		}

		const overdueLeases = await queryOverdueLeases(db, new Date(), authUser.id);
		const overdueByLeaseId = new Map(
			overdueLeases.map((lease) => [lease.leaseId, lease]),
		);

		const tenants = Array.from(tenantMap.values()).map((tenant) => {
			const activeLeases = tenant.activeLeases.map((lease) => {
				const overdue = overdueByLeaseId.get(lease.id);
				return {
					...lease,
					overdue: overdue
						? {
								paidAmount: overdue.paidAmount,
								outstandingAmount: overdue.outstandingAmount,
								dueDate: overdue.dueDate,
								daysOverdue: overdue.daysOverdue,
							}
						: null,
				};
			});

			return {
				...tenant,
				activeLeases,
				currentLease: activeLeases[0] ?? null,
			};
		});

		return { tenants };
	});

// 2) GetTenantsById
export const getTenantById = ownerProcedure
	.route({ method: "GET", path: "/rent/tenant/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ tenant: TenantDetailSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				// User identity
				tenantId: user.id,
				name: user.name,
				email: user.email,
				emailVerified: user.emailVerified,
				userPhone: user.phone,
				avatarUrl: user.image,
				invitedId: tenantProfiles.invitedId,
				// TenantProfile fields (all nullable if no profile row — shouldn't
				// happen before an invitation is accepted, but LEFT JOIN is safer)
				profileAddress: tenantProfiles.address,
				emergencyContact: tenantProfiles.emergencyContact,
				emergencyContactName: tenantProfiles.emergencyContactName,
				emergencyContactLocation: tenantProfiles.emergencyContactLocation,
				aadhaarLastFour: tenantProfiles.aadhaarLastFour,
				panNumber: tenantProfiles.panNumber,
				// Lease fields — all nullable when no active lease exists
				leaseId: leases.id,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
				rent: leases.rent,
				endDate: leases.endDate,
				createdAt: tenantProfiles.createdAt,
				updatedAt: tenantProfiles.updatedAt,
			})
			.from(tenantProfiles)
			// INNER JOIN user — profile always has a userId, safe to INNER
			.innerJoin(user, eq(tenantProfiles.userId, user.id))
			// LEFT JOIN leases with status in the condition (not WHERE)
			// ⚠️ If you move eq(leases.status, "active") to .where(), SQL treats
			//    NULL lease rows as "not active" and filters them out — defeating LEFT JOIN
			.leftJoin(
				leases,
				and(eq(leases.tenantId, user.id), eq(leases.status, "active")),
			)
			.leftJoin(units, eq(leases.unitId, units.id))
			.leftJoin(properties, eq(units.propertyId, properties.id))
			.where(
				// Both conditions must be true:
				// 1. This is the tenant being requested
				// 2. This owner created this tenant (authorization)
				and(
					eq(user.id, input.id),
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.orderBy(desc(leases.startDate));

		const [result] = results;

		// Zero rows: check if it's a pending invite (no tenantProfiles yet) — owner created via invite but not yet accepted
		// NOT_FOUND for both missing and cross-owner to prevent enumeration, but pending invite should be visible as tenant with status pending
		if (!result) {
			const [invite] = await db
				.select({
					id: tenantInvites.id,
					name: tenantInvites.name,
					email: tenantInvites.email,
					phone: tenantInvites.phone,
					status: tenantInvites.status,
					createdAt: tenantInvites.createdAt,
					updatedAt: tenantInvites.updatedAt,
				})
				.from(tenantInvites)
				.where(
					and(
						eq(tenantInvites.id, input.id),
						eq(tenantInvites.invitedById, authUser.id),
						isNull(tenantInvites.deletedAt),
					),
				)
				.limit(1);

			if (invite) {
				return {
					tenant: {
						id: invite.id,
						inviteId: invite.id,
						name: invite.name,
						email: invite.email,
						emailVerified: false,
						phone: invite.phone,
						avatarUrl: null,
						status: invite.status,
						profile: null,
						createdAt: invite.createdAt,
						updatedAt: invite.updatedAt,
						activeLeases: [],
						currentLease: null,
					},
				};
			}

			throw new ORPCError("NOT_FOUND", {
				message: "Tenant not found",
			});
		}

		const profile = {
			address: result.profileAddress,
			emergencyContact: result.emergencyContact,
			emergencyContactName: result.emergencyContactName,
			emergencyContactLocation: result.emergencyContactLocation,
			aadhaarLastFour: result.aadhaarLastFour,
			panNumber: result.panNumber
				? `${result.panNumber.slice(0, 2)}••••${result.panNumber.slice(-2)}`
				: null,
		};

		const activeLeases: TenantLeaseSummary[] = results
			.filter((row) => row.leaseId !== null)
			.map((row) => ({
				id: row.leaseId as string,
				propertyName: row.propertyName ?? "",
				unitNumber: row.unitNumber ?? "",
				rent: row.rent ?? 0,
				endDate: row.endDate ? row.endDate.toISOString() : null,
				overdue: null,
			}));

		// Option-A: if linked invite is still pending, tenant is pending (provisional profile exists so owner can upload/docs/lease before accept)
		let status: "pending" | "accepted" | "expired" = "accepted";
		let inviteId: string | null = null;
		if (result.invitedId) {
			const [invite] = await db
				.select({ status: tenantInvites.status, id: tenantInvites.id })
				.from(tenantInvites)
				.where(eq(tenantInvites.id, result.invitedId))
				.limit(1);
			if (invite) {
				inviteId = invite.id;
				if (invite.status === "pending") status = "pending";
				else if (invite.status === "expired") status = "expired";
				else status = "accepted";
			}
		}

		return {
			tenant: {
				id: result.tenantId,
				inviteId,
				name: result.name,
				email: result.email,
				emailVerified: result.emailVerified,
				phone: result.userPhone,
				avatarUrl: result.avatarUrl,
				status,
				profile,
				createdAt: result.createdAt,
				updatedAt: result.updatedAt,
				activeLeases,
				currentLease: activeLeases[0] ?? null,
			},
		};
	});

// 3) Owner creates an owner-prepared tenant invitation
export const createTenant = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/tenant/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateTenantSchema)
	.output(
		z.object({
			invite: InvitePublicSchema,
			deliveryStatus: z.enum(["sent", "failed", "suppressed"]),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		return createPendingTenantInvite(db, {
			ownerId: authUser.id,
			ownerName: authUser.name,
			input: {
				...input,
				onboardingMode: "owner_prepared",
			},
			suppressDelivery: isNonLiveWorkspace(authUser),
		});
	});

// 4) Remove
// Does NOT delete user account
export const removeTenant = ownerProcedure
	.route({ method: "DELETE", path: "/rent/tenant/remove" })
	.input(RemoveTenantSchema)
	.output(z.object({ success: z.boolean(), leasesTerminated: z.number() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const [tenantProfile] = await db
			.select({ id: tenantProfiles.id, inviteId: tenantProfiles.invitedId })
			.from(tenantProfiles)
			.where(
				and(
					eq(tenantProfiles.userId, input.tenantId),
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.limit(1);

		const [tenantInvite] = await db
			.select({ id: tenantInvites.id })
			.from(tenantInvites)
			.where(
				and(
					eq(tenantInvites.id, input.tenantId),
					eq(tenantInvites.invitedById, authUser.id),
					isNull(tenantInvites.deletedAt),
				),
			)
			.limit(1);

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

		// A tenant can be removed before a lease is created, or after all leases
		// have already ended. The owner association is the authorization source
		// in those cases; an active lease is not required.
		if (activeLeases.length === 0 && !tenantProfile && !tenantInvite) {
			throw new ORPCError("NOT_FOUND", {
				message: "Tenant not found on your properties.",
			});
		}

		const leaseIds = activeLeases.map((lease) => lease.leaseId);
		const unitIds = activeLeases.map((l) => l.unitId);
		const inviteId = tenantProfile?.inviteId ?? tenantInvite?.id;
		const now = new Date();

		if (supportsDatabaseBatch(db)) {
			const leaseQueries =
				leaseIds.length > 0
					? [
							db
								.update(leases)
								.set({ status: "terminated", updatedAt: now })
								.where(inArray(leases.id, leaseIds)),
							db
								.update(units)
								.set({ status: "available", updatedAt: now })
								.where(inArray(units.id, unitIds)),
						]
					: [];
			if (tenantProfile) {
				await db.batch([
					db
						.update(tenantProfiles)
						.set({ deletedAt: now, updatedAt: now })
						.where(eq(tenantProfiles.id, tenantProfile.id)),
					...leaseQueries,
					...(inviteId
						? [
								db
									.update(tenantInvites)
									.set({ status: "expired", updatedAt: now })
									.where(
										and(
											eq(tenantInvites.id, inviteId),
											eq(tenantInvites.invitedById, authUser.id),
										),
									),
							]
						: []),
				]);
			} else if (tenantInvite) {
				await db.batch([
					db
						.update(tenantInvites)
						.set({ status: "expired", updatedAt: now })
						.where(
							and(
								eq(tenantInvites.id, tenantInvite.id),
								eq(tenantInvites.invitedById, authUser.id),
							),
						),
					...leaseQueries,
				]);
			} else {
				await db.batch([
					db
						.update(leases)
						.set({ status: "terminated", updatedAt: now })
						.where(inArray(leases.id, leaseIds)),
					db
						.update(units)
						.set({ status: "available", updatedAt: now })
						.where(inArray(units.id, unitIds)),
				]);
			}
		} else {
			await db.transaction(async (tx) => {
				if (leaseIds.length > 0) {
					// Terminate leases and free their units.
					await tx
						.update(leases)
						.set({ status: "terminated", updatedAt: now })
						.where(inArray(leases.id, leaseIds));

					await tx
						.update(units)
						.set({ status: "available", updatedAt: now })
						.where(inArray(units.id, unitIds));
				}

				// Remove only this owner's association; keep the tenant account/history.
				if (tenantProfile) {
					await tx
						.update(tenantProfiles)
						.set({ deletedAt: now, updatedAt: now })
						.where(eq(tenantProfiles.id, tenantProfile.id));
				}

				if (inviteId) {
					await tx
						.update(tenantInvites)
						.set({ status: "expired", updatedAt: now })
						.where(
							and(
								eq(tenantInvites.id, inviteId),
								eq(tenantInvites.invitedById, authUser.id),
							),
						);
				}
			});
		}

		return {
			success: true,
			leasesTerminated: leaseIds.length,
		};
	});

// 5) Update tenant profile fields (KYC / contact info)
// NOTE: updates tenantProfiles table only — name/email live in Better Auth user table
export const updateTenant = ownerProcedure
	.route({ method: "PATCH", path: "/rent/tenant/update" })
	.input(
		UpdateTenantProfileSchema.extend({
			tenantId: z.string().min(1),
			name: z.string().min(1).optional(),
			email: z.email().optional(),
		}),
	)
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		const { tenantId, name, email, phone, ...profileFields } = input;

		// Authorization: verify this tenant has a lease on one of the owner's properties
		const [lease] = await db
			.select({ leaseId: leases.id })
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(leases.tenantId, tenantId),
					eq(properties.ownerId, authUser.id),
					eq(leases.status, "active"),
				),
			)
			.limit(1);

		if (!lease) {
			throw new ORPCError("FORBIDDEN", {
				message: "This tenant is not associated with your properties.",
			});
		}

		// Only update if there are actual fields to change
		const hasChanges = Object.values(profileFields).some(
			(v) => v !== undefined,
		);

		if (!hasChanges) {
			return { success: true };
		}

		// Scope the profile write to the rows THIS owner created. A tenant shared
		// across multiple owners must not have one owner overwrite another owner's
		// KYC/contact profile.
		await db
			.update(tenantProfiles)
			.set({ ...profileFields, phone, updatedAt: new Date() })
			.where(
				and(
					eq(tenantProfiles.userId, tenantId),
					eq(tenantProfiles.createdById, authUser.id),
				),
			);

		// name/email are global login identity fields owned by the tenant account,
		// not by any single property owner — never rewrite them here.

		return { success: true };
	});

// 6) Owner sends a custom email to tenant
export const sendEmailToTenant = ownerProcedure
	.route({ method: "POST", path: "/rent/tenant/send-email" })
	.input(
		z.object({
			tenantId: z.string().min(1),
			subject: z.string().min(1, { error: "Subject is required" }),
			message: z
				.string()
				.min(10, { error: "Message must be at least 10 characters" }),
		}),
	)
	.output(z.object({ sent: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Authorization + get tenant email in one query
		const [result] = await db
			.select({
				tenantEmail: user.email,
				tenantName: user.name,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(
				and(
					eq(leases.tenantId, input.tenantId),
					eq(properties.ownerId, authUser.id),
					eq(leases.status, "active"),
				),
			)
			.limit(1);

		if (!result) {
			throw new ORPCError("FORBIDDEN", {
				message: "Cannot send email: tenant not found on your properties.",
			});
		}

		// Non-blocking — consistent with invite/setup email pattern
		await sendCustomEmailToTenant({
			to: result.tenantEmail,
			tenantName: result.tenantName,
			ownerName: authUser.name,
			subject: input.subject,
			message: input.message,
		});

		return { sent: true };
	});

// 7) Re-send password-reset / account setup email to tenant
// Use case: tenant never received or lost their setup link
export const sendPasswordReset = ownerProcedure
	.route({ method: "POST", path: "/rent/tenant/send-reset" })
	.input(z.object({ tenantId: z.string().min(1) }))
	.output(z.object({ sent: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// ── Auth + email retrieval in one query ──────────────────────────────
		// Anchor: tenantProfiles — same as getTenantById.
		// This intentionally covers tenants with NO lease yet (just created).
		// If we anchored on leases, newly created tenants without a lease
		// assignment would be silently excluded and get a NOT_FOUND error.
		const [result] = await db
			.select({
				tenantEmail: user.email,
				tenantName: user.name,
			})
			.from(tenantProfiles)
			.innerJoin(user, eq(tenantProfiles.userId, user.id))
			.where(
				and(
					eq(tenantProfiles.userId, input.tenantId),
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.limit(1);

		if (!result) {
			throw new ORPCError("NOT_FOUND", {
				message: "Tenant not found",
			});
		}

		// ── Delegate to Better Auth ──────────────────────────────────────────
		// Better Auth generates its own signed token + sends the email.
		// We don't need to construct a URL ourselves — it uses the redirectTo
		// as the base path after the token is appended.
		try {
			await auth.api.requestPasswordReset({
				body: {
					email: result.tenantEmail,
					redirectTo: new URL("/set-password", env.WEB_APP_URL).toString(),
				},
			});
		} catch (err) {
			// Non-fatal: log but don't crash. Tenant exists — they can retry.
			console.error("[sendPasswordReset] Better Auth call failed", err);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to send reset email. Please try again.",
			});
		}

		return { sent: true };
	});
