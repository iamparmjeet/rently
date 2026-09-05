import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	notifications,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import z from "zod";
import { sendAutomaticUtilityBillEmail } from "../helpers/automatic-emails";
import { getAmountDueForUtility } from "../helpers/credit.helpers";
import { getSignedLedgerPayments } from "../helpers/signed-ledger";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

// **************
const READING_RATE_LIMIT_MAX = 5; // max submissions
const READING_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // per 1 hour

// ********************
//  1. Get My Active Lease
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
			.orderBy(desc(leases.createdAt))
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

// A tenant may have multiple active units under one combined agreement. Return
// the agreement as the navigation root so clients do not need to infer grouping
// from individual lease rows.
export const getMyAgreements = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/agreements" })
	.output(
		z.object({
			agreements: z.array(
				z.object({
					id: z.uuid(),
					arrangementType: z.string(),
					category: z.string(),
					startDate: z.date(),
					endDate: z.date().nullable(),
					rentDueDate: z.number().int().nullable(),
					description: z.string().nullable(),
					property: z.object({
						id: z.uuid(),
						name: z.string(),
						address: z.string(),
					}),
					owner: z.object({ name: z.string() }),
					units: z.array(
						z.object({
							leaseId: z.uuid(),
							unitId: z.uuid(),
							unitNumber: z.string(),
							unitType: z.string(),
							rent: z.number(),
							deposit: z.number().nullable(),
							status: z.string(),
						}),
					),
				}),
			),
		}),
	)
	.handler(async ({ context }) => {
		const rows = await context.db
			.select({
				agreementId: leaseAgreements.id,
				arrangementType: leaseAgreements.arrangementType,
				category: leaseAgreements.category,
				startDate: leaseAgreements.startDate,
				endDate: leaseAgreements.endDate,
				rentDueDate: leaseAgreements.rentDueDate,
				description: leaseAgreements.description,
				propertyId: properties.id,
				propertyName: properties.name,
				propertyAddress: properties.address,
				ownerName: user.name,
				leaseId: leases.id,
				unitId: units.id,
				unitNumber: units.unitNumber,
				unitType: units.type,
				rent: leases.rent,
				deposit: leases.deposit,
				status: leases.status,
			})
			.from(leaseAgreements)
			.innerJoin(leases, eq(leases.agreementId, leaseAgreements.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(properties.ownerId, user.id))
			.where(
				and(
					eq(leaseAgreements.tenantId, context.user.id),
					eq(leases.status, "active"),
				),
			)
			.orderBy(desc(leaseAgreements.createdAt), units.unitNumber);

		const agreements = new Map<
			string,
			{
				id: string;
				arrangementType: string;
				category: string;
				startDate: Date;
				endDate: Date | null;
				rentDueDate: number | null;
				description: string | null;
				property: { id: string; name: string; address: string };
				owner: { name: string };
				units: Array<{
					leaseId: string;
					unitId: string;
					unitNumber: string;
					unitType: string;
					rent: number;
					deposit: number | null;
					status: string;
				}>;
			}
		>();
		for (const row of rows) {
			const agreement = agreements.get(row.agreementId) ?? {
				id: row.agreementId,
				arrangementType: row.arrangementType,
				category: row.category,
				startDate: row.startDate,
				endDate: row.endDate,
				rentDueDate: row.rentDueDate,
				description: row.description,
				property: {
					id: row.propertyId,
					name: row.propertyName,
					address: row.propertyAddress,
				},
				owner: { name: row.ownerName ?? "Your Landlord" },
				units: [],
			};
			agreement.units.push({
				leaseId: row.leaseId,
				unitId: row.unitId,
				unitNumber: row.unitNumber,
				unitType: row.unitType,
				rent: row.rent,
				deposit: row.deposit,
				status: row.status,
			});
			agreements.set(row.agreementId, agreement);
		}

		return { agreements: [...agreements.values()] };
	});

//  2. Get My Payments
// WHY: Tenant can only see payments for their own leases (via leases.tenantId).
//      The JOIN scoping is the authorization — no explicit ownership check needed.
export const getMyPayments = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-portal/payments" })
	.output(
		z.object({
			payments: z.array(
				z.object({
					id: z.string(),
					leaseId: z.string(),
					unitNumber: z.string(),
					propertyName: z.string(),
					paymentGroupId: z.uuid().nullable(),
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

		const ledgerRows = await getSignedLedgerPayments(db, {
			tenantId: authUser.id,
		});
		const results = ledgerRows.map((payment) => ({
			id: payment.id,
			leaseId: payment.leaseId,
			unitNumber: payment.unitNumber,
			propertyName: payment.propertyName,
			paymentGroupId: payment.paymentGroupId,
			amount: payment.amount,
			paymentDate: payment.paymentDate,
			type: payment.type,
			paymentMethods: payment.paymentMethods,
			referenceNumber: payment.referenceNumber,
			description: payment.description,
			utilityType: payment.utilityType,
			createdAt: payment.createdAt,
		}));

		return { payments: results };
	});

//  3. Get My Utilities
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
					amountDue: z.number().int(),
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

		// Derived amountDue (total + credits − payments) is the source of truth for
		// paid state; the stored isPaid flag can drift after a credit/reversal.
		const enriched = await Promise.all(
			results.map(async (utility) => ({
				...utility,
				amountDue: await getAmountDueForUtility(db, utility.id),
			})),
		);

		return { utilities: enriched };
	});

//  4. Get My Profile
// WHY: Powers the tenant profile summary. Document state comes from the private
// tenant-document list procedure, not the legacy profile verification columns.
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
				aadhaarLastFour: z
					.string()
					.regex(/^\d{4}$/)
					.nullable(),
				panHint: z.string().nullable(),
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
				aadhaarLastFour: tenantProfiles.aadhaarLastFour,
				legacyPanNumber: tenantProfiles.panNumber,
			})
			.from(user)
			.leftJoin(tenantProfiles, eq(tenantProfiles.userId, user.id))
			.where(eq(user.id, authUser.id))
			.limit(1);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		return {
			profile: {
				name: row.name,
				email: row.email,
				phone: row.phone,
				address: row.address,
				emergencyContactName: row.emergencyContactName,
				emergencyContact: row.emergencyContact,
				aadhaarLastFour: row.aadhaarLastFour,
				panHint: row.legacyPanNumber
					? `${row.legacyPanNumber.slice(0, 2)}••••${row.legacyPanNumber.slice(-2)}`
					: null,
			},
		};
	});

//  5. Submit My Reading
// WHY: Tenants can submit their own electricity meter reading. This creates a
//      utility record scoped to their active lease, using the owner's configured
//      rate (from the last reading). The owner sees it as a new unpaid utility.
export const submitMyReading = protectedProcedure
	.use(async ({ context, next }) => {
		const { db, user } = context;
		const windowStart = new Date(Date.now() - READING_RATE_LIMIT_WINDOW_MS);

		const [result] = await db
			.select({ submissionCount: count() })
			.from(utilities)
			.innerJoin(leases, eq(utilities.leaseId, leases.id))
			.where(
				and(
					eq(leases.tenantId, user.id),
					gte(utilities.createdAt, windowStart),
				),
			);

		const submissionCount = Number(result?.submissionCount ?? 0);
		if (submissionCount >= READING_RATE_LIMIT_MAX) {
			throw new ORPCError("TOO_MANY_REQUESTS", {
				message:
					`You've submitted ${READING_RATE_LIMIT_MAX} readings in the last hour. ` +
					"Please wait before submitting again.",
			});
		}
		return next();
	})
	.route({
		method: "POST",
		path: "/rent/tenant-portal/submit-reading",
		successStatus: StatusCode.CREATED,
	})
	.input(
		z.object({
			currentReading: z
				.number()
				.int()
				.min(0, { error: "Reading must be ≥ 0" })
				.max(500, { error: "Reading seems too high - please double-check" }),
			readingDate: z
				.string()
				.min(1, { error: "Date is required" })
				.refine((s) => !Number.isNaN(Date.parse(s)), {
					error: "Invalid date format",
				})
				.refine((s) => new Date(s) <= new Date(), {
					error: "Reading date cannot be in the future",
				}),
			notes: z.string().max(200).optional(),
			// Required when a combined agreement has multiple active units so the
			// reading is billed to the correct flat rather than an arbitrary one.
			leaseId: z.uuid().optional(),
		}),
	)
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// STEP 1: Resolve the tenant's active lease(s)
		const activeLeases = await db
			.select({ id: leases.id })
			.from(leases)
			.where(
				and(eq(leases.tenantId, authUser.id), eq(leases.status, "active")),
			);

		if (activeLeases.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "No active lease found. Contact your landlord.",
			});
		}

		let activeLease: { id: string } | undefined;
		if (input.leaseId) {
			activeLease = activeLeases.find((l) => l.id === input.leaseId);
			if (!activeLease) {
				throw new ORPCError("FORBIDDEN", {
					message: "Lease not found among your active leases.",
				});
			}
		} else if (activeLeases.length === 1) {
			activeLease = activeLeases[0];
		} else {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Multiple active units — select which unit this reading belongs to.",
			});
		}
		const selectedLease = activeLease as { id: string };

		// Step2- Duplicate Monthly submission guard — race-safe via tx + FOR UPDATE
		const readingDate = new Date(input.readingDate);
		const monthStart = new Date(
			readingDate.getFullYear(),
			readingDate.getMonth(),
			1,
		);
		const monthEnd = new Date(
			readingDate.getFullYear(),
			readingDate.getMonth() + 1,
			1,
		);

		let utility: typeof utilities.$inferSelect | undefined;
		if (supportsBatch(db)) {
			const [existingThisMonth] = await db
				.select({ id: utilities.id, currentReading: utilities.currentReading })
				.from(utilities)
				.where(
					and(
						eq(utilities.leaseId, selectedLease.id),
						eq(utilities.utilityType, "electricity"),
						gte(utilities.currentReadingDate, monthStart),
						lt(utilities.currentReadingDate, monthEnd),
					),
				)
				.limit(1);

			if (existingThisMonth) {
				throw new ORPCError("CONFLICT", {
					message:
						`A reading of ${existingThisMonth.currentReading} kWh was already ` +
						"submitted for this month. Contact your landlord to correct it.",
				});
			}

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
						eq(utilities.leaseId, selectedLease.id),
						eq(utilities.utilityType, "electricity"),
					),
				)
				.orderBy(desc(utilities.currentReadingDate))
				.limit(1);

			const previousReading = lastReading?.currentReading ?? 0;
			const previousReadingDate = lastReading?.currentReadingDate ?? null;

			if (input.currentReading < (previousReading ?? 0)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Current reading (${input.currentReading}) cannot be less than previous reading (${previousReading}).`,
				});
			}

			const unitsUsed = input.currentReading - (previousReading ?? 0);
			const ratePerUnit = lastReading?.ratePerUnit ?? RATEPERUNIT;
			const fixedCharge = lastReading?.fixedCharge ?? FIXEDCHARGE;
			const totalAmount = Math.round(unitsUsed * ratePerUnit + fixedCharge);

			const [created] = await db
				.insert(utilities)
				.values({
					leaseId: selectedLease.id,
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
				})
				.returning();

			utility = created;
		} else {
			utility = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select 1 from ${leases} where ${leases.id} = ${selectedLease.id} for update`,
				);

				const [existingThisMonth] = await tx
					.select({
						id: utilities.id,
						currentReading: utilities.currentReading,
					})
					.from(utilities)
					.where(
						and(
							eq(utilities.leaseId, selectedLease.id),
							eq(utilities.utilityType, "electricity"),
							gte(utilities.currentReadingDate, monthStart),
							lt(utilities.currentReadingDate, monthEnd),
						),
					)
					.limit(1);

				if (existingThisMonth) {
					throw new ORPCError("CONFLICT", {
						message:
							`A reading of ${existingThisMonth.currentReading} kWh was already ` +
							"submitted for this month. Contact your landlord to correct it.",
					});
				}

				const [lastReading] = await tx
					.select({
						currentReading: utilities.currentReading,
						currentReadingDate: utilities.currentReadingDate,
						ratePerUnit: utilities.ratePerUnit,
						fixedCharge: utilities.fixedCharge,
					})
					.from(utilities)
					.where(
						and(
							eq(utilities.leaseId, selectedLease.id),
							eq(utilities.utilityType, "electricity"),
						),
					)
					.orderBy(desc(utilities.currentReadingDate))
					.limit(1);

				const previousReading = lastReading?.currentReading ?? 0;
				const previousReadingDate = lastReading?.currentReadingDate ?? null;

				if (input.currentReading < (previousReading ?? 0)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Current reading (${input.currentReading}) cannot be less than previous reading (${previousReading}).`,
					});
				}

				const unitsUsed = input.currentReading - (previousReading ?? 0);
				const ratePerUnit = lastReading?.ratePerUnit ?? RATEPERUNIT;
				const fixedCharge = lastReading?.fixedCharge ?? FIXEDCHARGE;
				const totalAmount = Math.round(unitsUsed * ratePerUnit + fixedCharge);

				const [created] = await tx
					.insert(utilities)
					.values({
						leaseId: selectedLease.id,
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
					})
					.returning();

				return created;
			});
		}

		try {
			const [leaseInfo] = await db
				.select({ ownerId: properties.ownerId, unitNumber: units.unitNumber })
				.from(leases)
				.innerJoin(units, eq(leases.unitId, units.id))
				.innerJoin(properties, eq(units.propertyId, properties.id))
				.where(eq(leases.id, selectedLease.id))
				.limit(1);

			if (utility && leaseInfo) {
				await sendAutomaticUtilityBillEmail({
					db,
					ownerId: leaseInfo.ownerId,
					utilityIds: [utility.id],
				});
			}

			if (leaseInfo) {
				await db.insert(notifications).values({
					userId: leaseInfo.ownerId,
					type: NOTIFICATION_TYPES.METER_READING_SUBMITTED,
					title: "New meter reading submitted",
					message: `Your tenant submitted a meter reading for Unit ${leaseInfo.unitNumber}`,
					entityId: selectedLease.id,
					entityType: "lease",
				});
			}
		} catch (error) {
			console.error(
				"[tenant-portal: submitMyReading] failed to submit notification:",
				error,
			);
			// WHY swallow: a failed notification must never fail the reading submission.
			// Owner can check manually; tenant's submission is already persisted.
		}

		return { success: true };
	});
