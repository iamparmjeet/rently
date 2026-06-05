// packages/api/src/routers/rent/tenant-portal.ts

import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	payments,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

// ─── 1. Get My Active Lease ────────────────────────────────────────────────────
// WHY: Tenant needs to see their unit/property context in every tab — this is
//      the "anchor" query. No active lease = no meaningful portal to show.
export const getMyActiveLease = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/lease" })
	.output(
		z.object({
			lease: z
				.object({
					id: z.string(),
					status: z.string(),
					rent: z.number(), // paise — always integers, never floats
					deposit: z.number().nullable(),
					startDate: z.date(),
					endDate: z.date().nullable(),
					unit: z.object({
						id: z.string(),
						unitNumber: z.string(),
						type: z.string(),
					}),
					property: z.object({
						id: z.string(),
						name: z.string(),
						address: z.string(),
					}),
					owner: z.object({
						name: z.string(),
					}),
				})
				.nullable(),
		}),
	)
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		// WHY: Single JOIN query — avoids N+1 and serializes cleanly for JSON transport.
		// The INNER JOIN on user (for owner name) is safe because every property
		// must have an ownerId — it's NOT NULL in the schema.
		const [row] = await db
			.select({
				leaseId: leases.id,
				status: leases.status,
				rent: leases.rent,
				deposit: leases.deposit,
				startDate: leases.startDate,
				endDate: leases.endDate,
				unitId: units.id,
				unitNumber: units.unitNumber,
				unitType: units.type,
				propertyId: properties.id,
				propertyName: properties.name,
				propertyAddress: properties.address,
				// WHY: We expose owner.name so the tenant knows who their landlord is,
				// but we never expose owner.email/phone here (tenant contacts via WhatsApp).
				ownerName: user.name,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(properties.ownerId, user.id))
			.where(and(eq(leases.tenantId, authUser.id), eq(leases.status, "active")))
			.limit(1);

		// WHY: null is a valid state — tenant may have been removed but still has
		// an account. Portal shows a "no active lease" state gracefully.
		if (!row) return { lease: null };

		return {
			lease: {
				id: row.leaseId,
				status: row.status,
				rent: row.rent,
				deposit: row.deposit,
				startDate: row.startDate,
				endDate: row.endDate,
				unit: {
					id: row.unitId,
					unitNumber: row.unitNumber,
					type: row.unitType,
				},
				property: {
					id: row.propertyId,
					name: row.propertyName,
					address: row.propertyAddress,
				},
				owner: { name: row.ownerName ?? "Your Landlord" },
			},
		};
	});

// ─── 2. Get My Payments ─────────────────────────────────────────────────────────
// WHY: Tenant can only see payments for their own leases (via leases.tenantId).
//      The JOIN scoping is the authorization — no explicit ownership check needed.
export const getMyPayments = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/payments" })
	.output(
		z.object({
			payments: z.array(
				z.object({
					id: z.string(),
					amount: z.number(), // paise
					paymentDate: z.date(),
					type: z.string(), // "rent" | "utility" | "deposit" | "reversal"
					paymentMethods: z.string().nullable(),
					referenceNumber: z.string().nullable(),
					description: z.string().nullable(),
					utilityType: z.string().nullable(), // enriched from utilities join
					createdAt: z.date(),
				}),
			),
		}),
	)
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				id: payments.id,
				amount: payments.amount,
				paymentDate: payments.paymentDate,
				type: payments.type,
				paymentMethods: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				description: payments.description,
				// WHY: LEFT JOIN utilities to get the utility type label for display
				// (e.g. "electricity" → "Electricity"). utilityId is nullable on payments.
				utilityType: utilities.utilityType,
				createdAt: payments.createdAt,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.leftJoin(utilities, eq(payments.utilityId, utilities.id))
			// GOTCHA: This WHERE is the authorization. Only payments where the
			// lease belongs to the logged-in tenant are returned.
			.where(eq(leases.tenantId, authUser.id))
			.orderBy(desc(payments.paymentDate));

		return { payments: results };
	});

// ─── 3. Get My Utilities ────────────────────────────────────────────────────────
// WHY: Powers both the "My Bill" tab (latest per type = current period charges)
//      and the "Reading" tab (history of meter readings). One query, two uses.
export const getMyUtilities = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/utilities" })
	.output(
		z.object({
			utilities: z.array(
				z.object({
					id: z.string(),
					leaseId: z.string(),
					utilityType: z.string(),
					previousReading: z.number().nullable(),
					currentReading: z.number().nullable(),
					previousReadingDate: z.date().nullable(),
					currentReadingDate: z.date().nullable(),
					unitsUsed: z.number().nullable(),
					ratePerUnit: z.number().nullable(),
					fixedCharge: z.number().nullable(),
					totalAmount: z.number(), // paise
					isPaid: z.boolean(),
					description: z.string().nullable(),
					createdAt: z.date(),
				}),
			),
		}),
	)
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		// WHY: DESC by currentReadingDate — the first item for each type is the
		// latest. Client-side reduces to latestByType with a simple reduce().
		const results = await db
			.select({
				id: utilities.id,
				leaseId: utilities.leaseId,
				utilityType: utilities.utilityType,
				previousReading: utilities.previousReading,
				currentReading: utilities.currentReading,
				previousReadingDate: utilities.previousReadingDate,
				currentReadingDate: utilities.currentReadingDate,
				unitsUsed: utilities.unitsUsed,
				ratePerUnit: utilities.ratePerUnit,
				fixedCharge: utilities.fixedCharge,
				totalAmount: utilities.totalAmount,
				isPaid: utilities.isPaid,
				description: utilities.description,
				createdAt: utilities.createdAt,
			})
			.from(utilities)
			.innerJoin(leases, eq(utilities.leaseId, leases.id))
			.where(eq(leases.tenantId, authUser.id))
			.orderBy(desc(utilities.currentReadingDate));

		return { utilities: results };
	});

// ─── 4. Get My Profile ──────────────────────────────────────────────────────────
// WHY: Powers the "Profile & Docs" tab. Reads the user row + tenantProfiles row.
//      verificationStatus drives the doc status badges (pending/verified).
export const getMyProfile = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/profile" })
	.output(
		z.object({
			profile: z.object({
				name: z.string(),
				email: z.string(),
				phone: z.string().nullable(),
				address: z.string().nullable(),
				emergencyContactName: z.string().nullable(),
				emergencyContact: z.string().nullable(),
				uidNumber: z.string().nullable(),
				panNumber: z.string().nullable(),
				verificationStatus: z.string().nullable(),
			}),
		}),
	)
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		// WHY: LEFT JOIN tenantProfiles because there's a theoretical edge case
		// where a user exists but no profile row was created (race condition during
		// createTenant transaction failure). The portal should still show basic info.
		const [row] = await db
			.select({
				name: user.name,
				email: user.email,
				phone: user.phone,
				address: tenantProfiles.address,
				emergencyContactName: tenantProfiles.emergencyContactName,
				emergencyContact: tenantProfiles.emergencyContact,
				uidNumber: tenantProfiles.uidNumber,
				panNumber: tenantProfiles.panNumber,
				verificationStatus: tenantProfiles.verificationStatus,
			})
			.from(user)
			.leftJoin(tenantProfiles, eq(tenantProfiles.userId, user.id))
			.where(eq(user.id, authUser.id))
			.limit(1);

		if (!row) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "User not found",
			});
		}

		return { profile: row };
	});

// ─── 5. Submit My Reading ───────────────────────────────────────────────────────
// WHY: Tenants can submit their own electricity meter reading. This creates a
//      utility record scoped to their active lease, using the owner's configured
//      rate (from the last reading). The owner sees it as a new unpaid utility.
export const submitMyReading = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/tenant-portal/submit-reading",
		successStatus: StatusCode.CREATED,
	})
	.input(
		z.object({
			currentReading: z.number().int().min(0, { error: "Reading must be ≥ 0" }),
			readingDate: z.string().min(1, { error: "Date is required" }),
			notes: z.string().max(200).optional(),
		}),
	)
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// STEP 1: Find the tenant's active lease
		const [activeLease] = await db
			.select({ id: leases.id })
			.from(leases)
			.where(and(eq(leases.tenantId, authUser.id), eq(leases.status, "active")))
			.limit(1);

		if (!activeLease) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "No active lease found. Contact your landlord.",
			});
		}

		// STEP 2: Get the previous electricity reading for this lease
		// WHY: We look up the most recent electricity reading to compute unitsUsed
		// and carry forward the rate the owner configured.
		const [lastReading] = await db
			.select({
				currentReading: utilities.currentReading,
				currentReadingDate: utilities.currentReadingDate,
				ratePerUnit: utilities.ratePerUnit,
				fixedCharge: utilities.fixedCharge,
			})
			.from(utilities)
			.where(
				and(
					eq(utilities.leaseId, activeLease.id),
					eq(utilities.utilityType, "electricity"),
				),
			)
			.orderBy(desc(utilities.currentReadingDate))
			.limit(1);

		const previousReading = lastReading?.currentReading ?? 0;
		const previousReadingDate = lastReading?.currentReadingDate ?? null;

		// GOTCHA: currentReading must be >= previousReading
		if (input.currentReading < (previousReading ?? 0)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Current reading (${input.currentReading}) cannot be less than previous reading (${previousReading}).`,
			});
		}

		const unitsUsed = input.currentReading - (previousReading ?? 0);
		const ratePerUnit = lastReading?.ratePerUnit ?? RATEPERUNIT;
		const fixedCharge = lastReading?.fixedCharge ?? FIXEDCHARGE;
		const totalAmount = Math.round(unitsUsed * ratePerUnit + fixedCharge);

		await db.insert(utilities).values({
			leaseId: activeLease.id,
			utilityType: "electricity",
			previousReading: previousReading ?? null,
			currentReading: input.currentReading,
			previousReadingDate,
			currentReadingDate: new Date(input.readingDate),
			unitsUsed,
			ratePerUnit,
			fixedCharge,
			totalAmount,
			description: input.notes ?? null,
			isPaid: false,
		});

		return { success: true };
	});
