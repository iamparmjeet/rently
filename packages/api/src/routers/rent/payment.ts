import { ORPCError } from "@orpc/server";
import { workspaceCapabilities } from "@rently/api/modules/sample-workspace";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { OWNER_ONLY_PAYMENT_METHODS_VALUE } from "@rently/db/constants/payment-constants";
import {
	LEASE_AGREEMENT_ARRANGEMENT,
	PAYMENT_TYPES,
} from "@rently/db/constants/rent-constants";
import type { UserRole } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leaseAgreements,
	leases,
	notifications,
	paymentGroups,
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	sendAgreementPaymentReceiptEmail,
	sendPaymentReceiptEmail,
} from "@rently/email";
import {
	CreateAgreementPaymentSchema,
	CreateCombinedBillPaymentSchema,
	CreatePaymentRequestSchema,
	PaymentGroupSelectSchema,
	PaymentListItemSchema,
	PaymentSelectSchema,
	UpdatePaymentSchema,
} from "@rently/validators";
import { and, desc, eq, inArray, isNull, type SQL, sql } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";
import {
	sendAutomaticAgreementPaymentReceipt,
	sendAutomaticPaymentReceipt,
} from "../helpers/automatic-emails";
import { getAmountDueForUtility } from "../helpers/credit.helpers";
import { getLeasePeriodDue } from "../helpers/period-balance";
import {
	allocateRentPaymentsSql,
	ensureAccruedChargesSql,
	ensureNextFuturePeriodChargeSql,
	mirrorPaymentGroupReversalsSql,
	mirrorPaymentReversalSql,
	rentOutstandingSql,
	reportUnallocatedRentPaymentRemaindersSql,
} from "../helpers/rent-period";
import { settlementAdvisoryLock } from "../helpers/settlement-lock";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

const formatRupees = (paise: number) =>
	new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(paise / 100);

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

// Drizzle wraps driver errors (the Postgres code nests under cause); read
// both so constraint arbitration works on every path.
function violationCode(error: unknown): string | undefined {
	const top = error as { code?: unknown; cause?: unknown } | null;
	if (typeof top?.code === "string") return top.code;
	const cause = top?.cause as { code?: unknown } | null | undefined;
	if (typeof cause?.code === "string") return cause.code;
	return undefined;
}

function groupedPaymentRequestFingerprint(input: {
	agreementId: string;
	paymentDate: Date;
	paymentMethods?: string | null;
	referenceNumber?: string | null;
	description?: string | null;
}): string {
	// Keep the representation deterministic across Node and Neon HTTP. The
	// grouped command has no client-supplied allocation list; its allocation
	// policy is server-owned, so the fingerprint covers the complete request
	// accepted by this API and deliberately excludes server-side balances.
	return JSON.stringify({
		agreementId: input.agreementId,
		paymentDate: input.paymentDate.toISOString(),
		paymentMethods: input.paymentMethods ?? null,
		referenceNumber: input.referenceNumber ?? null,
		description: input.description ?? null,
	});
}

// The combined-bill command shares the group-level idempotency metadata with
// grouped rent settlements (B09): the key is scoped to (agreement, key) and a
// fingerprint mismatch is a conflict. The fingerprint covers the bills named by
// the caller plus the request metadata; allocation amounts are server-derived
// balances and deliberately excluded.
function combinedBillRequestFingerprint(input: {
	agreementId: string;
	leaseId: string;
	utilityIds: string[];
	paymentDate: Date;
	paymentMethods?: string | null;
	referenceNumber?: string | null;
	description?: string | null;
}): string {
	return JSON.stringify({
		agreementId: input.agreementId,
		leaseId: input.leaseId,
		utilityIds: [...input.utilityIds].sort(),
		paymentDate: input.paymentDate.toISOString(),
		paymentMethods: input.paymentMethods ?? null,
		referenceNumber: input.referenceNumber ?? null,
		description: input.description ?? null,
	});
}

async function readGroupedPaymentResult(
	db: Pick<Database, "select">,
	groupId: string,
) {
	const [paymentGroup] = await db
		.select()
		.from(paymentGroups)
		.where(eq(paymentGroups.id, groupId));
	if (!paymentGroup) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Grouped payment idempotency record is incomplete",
		});
	}
	const createdPayments = await db
		.select()
		.from(payments)
		.where(eq(payments.paymentGroupId, groupId));
	return { paymentGroup, payments: createdPayments };
}

async function findGroupedPaymentReplay(
	db: Pick<Database, "select">,
	ownerId: string,
	agreementId: string,
	idempotencyKey: string,
	requestFingerprint: string,
) {
	// Scope the key lookup before reading any financial rows. Agreement UUIDs
	// are globally unique, while the property join is the authoritative owner
	// boundary; neither owner nor agreement is inferred from the key itself.
	const [existingGroup] = await db
		.select({
			id: paymentGroups.id,
			requestFingerprint: paymentGroups.requestFingerprint,
		})
		.from(paymentGroups)
		.innerJoin(
			leaseAgreements,
			eq(paymentGroups.agreementId, leaseAgreements.id),
		)
		.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
		.where(
			and(
				eq(paymentGroups.idempotencyKey, idempotencyKey),
				eq(paymentGroups.agreementId, agreementId),
				eq(properties.ownerId, ownerId),
			),
		)
		.limit(1);
	if (!existingGroup) return undefined;
	if (existingGroup.requestFingerprint !== requestFingerprint) {
		throw new ORPCError("CONFLICT", {
			message:
				"Idempotency key was already used with a different grouped payment request",
		});
	}
	return readGroupedPaymentResult(db, existingGroup.id);
}

async function findReversalByOriginal(
	db: Pick<Database, "select">,
	originalId: string,
) {
	const [row] = await db
		.select()
		.from(payments)
		.where(
			and(
				eq(payments.type, PAYMENT_TYPES.REVERSAL),
				eq(payments.reversesPaymentId, originalId),
			),
		)
		.limit(1);
	return row;
}

type IndividualPaymentInput = {
	id: string;
	leaseId: string;
	amount: number;
	paymentDate: Date;
	type: string;
	paymentMethods: string | null;
	referenceNumber: string | null;
	description: string | null;
	utilityId: string | null;
	idempotencyKey: string | null;
};

async function insertNeonPayment(
	db: BatchCapableDatabase,
	input: IndividualPaymentInput,
) {
	const id = input.id;
	const lockQuery = db.execute(
		sql`SELECT ${settlementAdvisoryLock(input.utilityId ? "utility" : "lease", input.utilityId ?? input.leaseId)}`,
	);
	// Rent payments may be partial (C01 R8) but never advance the lease: the
	// insert goes through only when the outstanding balance covers the amount.
	// Utility settlement keeps its exact-balance rule.
	const insertQuery = input.utilityId
		? db.execute<{ id: string }>(sql`
			WITH balance AS MATERIALIZED (
				SELECT u."total_amount"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."utility_id" = u."id"
					), 0)
					- COALESCE((
						SELECT sum(p."amount")
						FROM ${payments} p
						WHERE p."utility_id" = u."id"
					), 0) AS "amount_due"
				FROM ${utilities} u
				WHERE u."id" = ${input.utilityId}
			), inserted AS (
				INSERT INTO ${payments} (
					"id", "lease_id", "amount", "payment_date", "payment_method",
					"reference_number", "type", "description", "utility_id",
					"idempotency_key"
				)
				SELECT ${id}, ${input.leaseId}, ${input.amount}, ${input.paymentDate},
					${input.paymentMethods}, ${input.referenceNumber}, ${input.type},
					${input.description}, ${input.utilityId}, ${input.idempotencyKey}
				FROM balance
				WHERE balance."amount_due" = ${input.amount}
				RETURNING "id", "amount"
			), updated AS (
				UPDATE ${utilities} u
				SET "is_paid" = (
					u."total_amount"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."utility_id" = u."id"
					), 0)
						- COALESCE((
							SELECT sum(p."amount")
							FROM ${payments} p
							WHERE p."utility_id" = u."id"
						), 0) - inserted."amount" <= 0
				), "updated_at" = now()
				FROM inserted
				WHERE u."id" = ${input.utilityId}
				RETURNING u."id"
			)
			SELECT inserted."id" AS "id"
			FROM inserted
			LEFT JOIN updated ON true
		`)
		: db.execute<{ id: string }>(sql`
			WITH balance AS MATERIALIZED (
				-- C08: the period outstanding IS the rent due; an accepted payment
				-- may also prepay at most one future period (R6) MINUS whatever
				-- earlier prepays already sit there — never beyond one month's
				-- rent of headroom. The R6 charge is created below the batch when
				-- this insert survives and the amount exceeds the current dues.
				SELECT
					COALESCE(SUM(CASE WHEN c."period_key" < x."next"
						THEN c."amount" - COALESCE(ra."allocated", 0) ELSE 0 END), 0)
					+ CASE
						WHEN l."status" = 'active'
							AND l."start_date"::date < (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 month')
							AND (l."end_date" IS NULL OR l."end_date"::date >= (date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') + interval '2 months'))
						THEN GREATEST(l."rent" - COALESCE(SUM(CASE WHEN c."period_key" >= x."next"
							THEN c."amount" - COALESCE(ra."allocated", 0) ELSE 0 END), 0), 0)
						ELSE 0
					END AS "amount_due"
				FROM ${leases} l
				CROSS JOIN (SELECT to_char(date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 month', 'YYYY-MM') AS "next") x
				LEFT JOIN ${rentCharges} c ON c."lease_id" = l."id"
				LEFT JOIN (
					SELECT "charge_id", SUM("amount") AS "allocated"
					FROM ${rentAllocations} GROUP BY "charge_id"
				) ra ON ra."charge_id" = c."id"
				WHERE l."id" = ${input.leaseId}
				GROUP BY l."id", l."status", l."rent", l."start_date", l."end_date", x."next"
			), inserted AS (
				INSERT INTO ${payments} (
					"id", "lease_id", "amount", "payment_date", "payment_method",
					"reference_number", "type", "description", "utility_id",
					"idempotency_key"
				)
				SELECT ${id}, ${input.leaseId}, ${input.amount}, ${input.paymentDate},
					${input.paymentMethods}, ${input.referenceNumber}, ${input.type},
					${input.description}, NULL, ${input.idempotencyKey}
				FROM balance
				WHERE balance."amount_due" >= ${input.amount}
				RETURNING "id", "amount"
			)
			SELECT inserted."id" AS "id" FROM inserted
		`);

	// C04/C08: accrue charges (through the current period and, for a legal
	// prepay, the next one) BEFORE the insert so the outstanding bound sees
	// them, then allocate FIFO. Accrual is idempotent and represents rent the
	// lease owes regardless of the payment outcome; only the allocation is
	// gated on the payment row existing, so a refused insert allocates nothing.
	const batch: Array<{ getSQL: () => unknown }> = [lockQuery];
	if (!input.utilityId && input.type === PAYMENT_TYPES.RENT) {
		batch.push(db.execute(ensureAccruedChargesSql({ leaseId: input.leaseId })));
	}
	batch.push(insertQuery);
	// The insert's position shifts when rent accrual statements precede it.
	const insertIndex = batch.length - 1;
	if (!input.utilityId && input.type === PAYMENT_TYPES.RENT) {
		// R6: the next period's charge exists only when the (now-inserted)
		// payment actually prepays beyond the outstanding charges.
		batch.push(
			db.execute(
				ensureNextFuturePeriodChargeSql(
					{ leaseId: input.leaseId },
					sql`SELECT 1 FROM "payments" p
						WHERE p."id" = ${input.id}
							AND p."amount" > ${rentOutstandingSql()}`,
				),
			),
			db.execute(allocateRentPaymentsSql(sql`p."id" = ${input.id}`)),
			db.execute(
				reportUnallocatedRentPaymentRemaindersSql(sql`p."id" = ${input.id}`),
			),
		);
	}
	const results = await db.batch(batch);
	const result = results[insertIndex] as (typeof results)[number] & {
		rows: Array<{ id: string }>;
	};
	return result.rows[0]?.id;
}

async function insertNeonPaymentReversal(
	db: BatchCapableDatabase,
	input: {
		id: string;
		leaseId: string;
		amount: number;
		paymentDate: Date;
		description: string;
		referenceNumber: string;
		utilityId: string | null;
		reversesPaymentId: string;
	},
) {
	const id = input.id;
	const lockQuery = db.execute(
		sql`SELECT ${settlementAdvisoryLock(input.utilityId ? "utility" : "lease", input.utilityId ?? input.leaseId)}`,
	);
	const insertQuery = input.utilityId
		? db.execute<{ id: string }>(sql`
			WITH inserted AS (
				INSERT INTO ${payments} (
					"id", "lease_id", "amount", "payment_date", "type", "description",
					"reference_number", "utility_id", "reverses_payment_id"
				)
				SELECT ${id}, ${input.leaseId}, ${input.amount}, ${input.paymentDate},
					'reversal', ${input.description}, ${input.referenceNumber},
					${input.utilityId}, ${input.reversesPaymentId}
				RETURNING "id", "amount"
			), updated AS (
				UPDATE ${utilities} u
				SET "is_paid" = (
					u."total_amount"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."utility_id" = u."id"
					), 0)
						- COALESCE((
							SELECT sum(p."amount")
							FROM ${payments} p
							WHERE p."utility_id" = u."id"
						), 0) - inserted."amount" <= 0
				), "updated_at" = now()
				FROM inserted
				WHERE u."id" = ${input.utilityId}
				RETURNING u."id"
			)
			SELECT inserted."id" AS "id"
			FROM inserted
			LEFT JOIN updated ON true
		`)
		: db.execute<{ id: string }>(sql`
			WITH inserted AS (
				INSERT INTO ${payments} (
					"id", "lease_id", "amount", "payment_date", "type", "description",
					"reference_number", "utility_id", "reverses_payment_id"
				)
				SELECT ${id}, ${input.leaseId}, ${input.amount}, ${input.paymentDate},
					'reversal', ${input.description}, ${input.referenceNumber},
					NULL, ${input.reversesPaymentId}
				RETURNING "id", "amount"
			)
			SELECT inserted."id" AS "id" FROM inserted
			`);

	// C04 dual-write: the reversal mirrors its original's period allocations
	// (a no-op for utility originals — they hold no rent allocations).
	const results = await db.batch([
		lockQuery,
		insertQuery,
		db.execute(mirrorPaymentReversalSql(input.id, input.reversesPaymentId)),
	]);
	const result = results[1] as (typeof results)[number] & {
		rows: Array<{ id: string }>;
	};
	return result.rows[0]?.id;
}

async function syncUtilityPaidFlag(
	db: Pick<Database, "select" | "update">,
	utilityId: string,
) {
	const dueAfter = await getAmountDueForUtility(db, utilityId);
	await db
		.update(utilities)
		.set({ isPaid: dueAfter <= 0 })
		.where(eq(utilities.id, utilityId));
}

// Grouped reversals may reopen utility bills — keep the compatibility isPaid
// flag in sync with the derived amountDue (parity with voidPayment).
async function syncGroupUtilityFlags(
	db: Pick<Database, "select" | "update">,
	originalPayments: Array<{ utilityId: string | null }>,
) {
	const utilityIds = [
		...new Set(
			originalPayments
				.map((payment) => payment.utilityId)
				.filter((id): id is string => Boolean(id)),
		),
	];
	for (const utilityId of utilityIds) {
		await syncUtilityPaidFlag(db, utilityId);
	}
}

async function findReversalGroup(
	db: Pick<Database, "select">,
	originalGroupId: string,
) {
	const [group] = await db
		.select()
		.from(paymentGroups)
		.where(eq(paymentGroups.reversesPaymentGroupId, originalGroupId))
		.limit(1);
	if (!group) return undefined;
	const allocations = await db
		.select()
		.from(payments)
		.where(eq(payments.paymentGroupId, group.id));
	return { group, allocations };
}

// Serve an existing reversal group only when every allocation is present.
// A partial group means a crashed write — loud repair signal, never silent.
async function returnCompleteGroupReversal(
	db: Pick<Database, "select" | "update">,
	originalPayments: Array<{ id: string; utilityId: string | null }>,
	existing: NonNullable<Awaited<ReturnType<typeof findReversalGroup>>>,
) {
	if (existing.allocations.length !== originalPayments.length) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message:
				"Partial group reversal detected — manual repair required before retrying",
		});
	}
	await syncGroupUtilityFlags(db, originalPayments);
	return { paymentGroup: existing.group, reversals: existing.allocations };
}

// ─── Shared helper ─────
function assertMethodAllowedForRole(
	method: string | null | undefined,
	role: UserRole,
) {
	if (!method) return;
	const isOwnerOnly = (
		OWNER_ONLY_PAYMENT_METHODS_VALUE as readonly string[]
	).includes(method);

	if (isOwnerOnly && role !== "owner") {
		throw new ORPCError("FORBIDDEN", {
			message: "Cash and cheque payments can only be recorded by the owner",
		});
	}
}
// Fetches a payment + walks the JOIN chain to get ownerId for auth
async function getOwnedPayment(
	db: Database,
	paymentId: string,
	userId: string,
) {
	const [row] = await db
		.select({
			id: payments.id,
			leaseId: payments.leaseId,
			amount: payments.amount,
			paymentDate: payments.paymentDate,
			paymentMethods: payments.paymentMethods,
			referenceNumber: payments.referenceNumber,
			type: payments.type,
			description: payments.description,
			utilityId: payments.utilityId,
			createdAt: payments.createdAt,
			updatedAt: payments.updatedAt,
			paymentGroupId: payments.paymentGroupId,
			reversesPaymentId: payments.reversesPaymentId,
			ownerId: properties.ownerId,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(payments.id, paymentId))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not own this payment",
		});
	}

	return row;
}

// Create — GST-safe: amount must equal derived amountDue, isPaid derived, reversal blocked via Zod
export const createPayment = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreatePaymentRequestSchema)
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Reversal exclusion + type/utility pairing are enforced by
		// CreatePaymentRequestSchema; the database CHECK is the backstop.

		const ownsLease = await isLeaseOwner(db, authUser.id, input.leaseId);
		if (!ownsLease) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this lease",
			});
		}

		assertMethodAllowedForRole(input.paymentMethods, "owner");

		const utilityId = input.utilityId ?? null;

		// Validate utility belongs to lease when provided
		if (utilityId) {
			const [util] = await db
				.select({ id: utilities.id, leaseId: utilities.leaseId })
				.from(utilities)
				.where(eq(utilities.id, utilityId))
				.limit(1);
			if (!util || util.leaseId !== input.leaseId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Utility does not belong to this lease",
				});
			}
		}

		// A client-supplied idempotency key makes a double-submit self-reject via
		// the partial unique index, closing the Neon HTTP race (no FOR UPDATE).
		const idempotencyKey = input.idempotencyKey ?? null;

		let payment: typeof payments.$inferSelect | undefined;
		if (supportsBatch(db)) {
			if (idempotencyKey) {
				const [existingPayment] = await db
					.select()
					.from(payments)
					.where(
						and(
							eq(payments.leaseId, input.leaseId),
							eq(payments.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existingPayment) {
					return { payment: existingPayment };
				}
			}

			let insertedId: string | undefined;
			if (
				utilityId ||
				(input.type ?? PAYMENT_TYPES.RENT) === PAYMENT_TYPES.RENT
			) {
				try {
					insertedId = await insertNeonPayment(db, {
						id: crypto.randomUUID(),
						leaseId: input.leaseId,
						amount: input.amount,
						paymentDate: input.paymentDate,
						type: input.type ?? PAYMENT_TYPES.RENT,
						paymentMethods: input.paymentMethods ?? null,
						referenceNumber: input.referenceNumber ?? null,
						description: input.description ?? null,
						utilityId,
						idempotencyKey,
					});
				} catch (error) {
					if (violationCode(error) !== "23505") throw error;
				}
			} else {
				try {
					const [newPayment] = await db
						.insert(payments)
						.values({
							leaseId: input.leaseId,
							amount: input.amount,
							paymentDate: input.paymentDate,
							type: input.type ?? PAYMENT_TYPES.RENT,
							paymentMethods: input.paymentMethods ?? null,
							referenceNumber: input.referenceNumber ?? null,
							description: input.description ?? null,
							utilityId,
							idempotencyKey,
						})
						.returning();
					insertedId = newPayment?.id;
				} catch (error) {
					if (violationCode(error) !== "23505") throw error;
				}
			}
			if (!insertedId && idempotencyKey) {
				const [existingPayment] = await db
					.select()
					.from(payments)
					.where(
						and(
							eq(payments.leaseId, input.leaseId),
							eq(payments.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existingPayment) {
					return { payment: existingPayment };
				}
			}
			if (insertedId) {
				[payment] = await db
					.select()
					.from(payments)
					.where(eq(payments.id, insertedId))
					.limit(1);
			}
			if (
				!payment &&
				(utilityId || (input.type ?? PAYMENT_TYPES.RENT) === PAYMENT_TYPES.RENT)
			) {
				const due = utilityId
					? await getAmountDueForUtility(db, utilityId)
					: (await getLeasePeriodDue(db, input.leaseId)).maxAllowed;
				throw new ORPCError("BAD_REQUEST", {
					message: utilityId
						? `Payment must equal the outstanding utility balance of ${formatRupees(due)}. Advance payments are not supported.`
						: `Payment exceeds the outstanding rent balance plus the one-period advance cap of ${formatRupees(due)}.`,
				});
			}
		} else {
			payment = await db.transaction(async (tx) => {
				if (utilityId) {
					await tx.execute(
						sql`select 1 from ${utilities} where ${utilities.id} = ${utilityId} for update`,
					);
				} else {
					await tx.execute(
						sql`select 1 from ${leases} where ${leases.id} = ${input.leaseId} for update`,
					);
				}

				if (idempotencyKey) {
					const [existingPayment] = await tx
						.select()
						.from(payments)
						.where(
							and(
								eq(payments.leaseId, input.leaseId),
								eq(payments.idempotencyKey, idempotencyKey),
							),
						)
						.limit(1);
					if (existingPayment) return existingPayment;
				}

				if (utilityId) {
					const due = await getAmountDueForUtility(tx, utilityId);
					if (input.amount !== due) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Payment must equal the outstanding utility balance of ${formatRupees(due)}. Advance payments are not supported.`,
						});
					}
				} else if (input.type === PAYMENT_TYPES.RENT) {
					// C08: the period outstanding IS the rent due. Accrue first so
					// the bound sees the full charge set (the tx rolls back on a
					// failed validation, so this is side-effect free); partials
					// settle part of it (R8); anything beyond it prepays at most
					// one future period (R6), whose charge the accrual creates.
					await tx.execute(ensureAccruedChargesSql({ leaseId: input.leaseId }));
					const bound = await getLeasePeriodDue(tx, input.leaseId);
					if (input.amount > bound.maxAllowed) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Payment exceeds the outstanding rent balance plus the one-period advance cap of ${formatRupees(bound.maxAllowed)}.`,
						});
					}
					// R6: the next period's charge exists only when this payment
					// actually prepays beyond the outstanding charges — never as a
					// side effect of an ordinary settlement.
					if (input.amount > bound.outstanding) {
						await tx.execute(
							ensureNextFuturePeriodChargeSql({ leaseId: input.leaseId }),
						);
					}
				}

				const [newPayment] = await tx
					.insert(payments)
					.values({
						leaseId: input.leaseId,
						amount: input.amount,
						paymentDate: input.paymentDate,
						type: input.type ?? PAYMENT_TYPES.RENT,
						paymentMethods: input.paymentMethods ?? null,
						referenceNumber: input.referenceNumber ?? null,
						description: input.description ?? null,
						utilityId,
						idempotencyKey,
					})
					.returning();

				if (utilityId) {
					const dueAfter = await getAmountDueForUtility(tx, utilityId);
					await tx
						.update(utilities)
						.set({ isPaid: dueAfter <= 0 })
						.where(eq(utilities.id, utilityId));
				} else if ((input.type ?? PAYMENT_TYPES.RENT) === PAYMENT_TYPES.RENT) {
					// C04/C08: charges were accrued before validation; pour the
					// payment FIFO and list any remainder a divergent history
					// cannot absorb — atomically.
					if (!newPayment) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Failed to record payment",
						});
					}
					await tx.execute(
						allocateRentPaymentsSql(sql`p."id" = ${newPayment.id}`),
					);
					await tx.execute(
						reportUnallocatedRentPaymentRemaindersSql(
							sql`p."id" = ${newPayment.id}`,
						),
					);
				}

				return newPayment;
			});
		}

		if (!payment) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record payment",
			});
		}

		await sendAutomaticPaymentReceipt(db, authUser.id, payment.id);

		return { payment };
	});

// Neon HTTP grouped settlement (B10). The advisory locks use the same
// per-lease key domain as individual settlements, so a grouped batch and an
// individual payment serialize on every lease it touches. The insert
// statement recomputes each active lease's rent due from committed rows and
// gates the group and allocation inserts on the validation predicate, so a
// stale pre-lock balance can never be written.
function groupedNeonLockQuery(db: BatchCapableDatabase, agreementId: string) {
	return db.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended('rently:settlement:lease:' || l."id"::text, 0)
		)
		from ${leases} l
		where l."agreement_id" = ${agreementId} and l."status" = 'active'
		order by l."id"
	`);
}

function groupedNeonInsertQuery(
	db: BatchCapableDatabase,
	params: {
		agreementId: string;
		groupId: string;
		paymentDate: Date;
		paymentMethods: string | null;
		referenceNumber: string | null;
		description: string | null;
		idempotencyKey: string | null;
		requestFingerprint: string;
	},
) {
	// The due expression is the C08 period outstanding: charges minus
	// allocations per lease (rentOutstandingSql), the same value the balance
	// read model reports as totalRentDue.
	return db.execute<{
		group_id: string | null;
		payment_count: number;
		lease_count: number;
		all_positive: boolean;
	}>(sql`
		with dues as materialized (
			select l."id" as "lease_id",
				${rentOutstandingSql()} as "due"
			from ${leases} l
			where l."agreement_id" = ${params.agreementId} and l."status" = 'active'
		),
		validation as materialized (
			select count(*)::int as "lease_count",
				coalesce(bool_and(d."due" > 0), false) as "all_positive"
			from dues d
		),
		inserted_group as (
			insert into ${paymentGroups} (
				"id", "agreement_id", "payment_date", "payment_method",
				"reference_number", "description", "idempotency_key",
				"request_fingerprint"
			)
			select ${params.groupId}, ${params.agreementId}, ${params.paymentDate},
				${params.paymentMethods}, ${params.referenceNumber},
				${params.description}, ${params.idempotencyKey},
				${params.requestFingerprint}
			from validation
			where validation."lease_count" >= 2 and validation."all_positive"
			returning "id"
		),
		inserted_payments as (
			insert into ${payments} (
				"id", "lease_id", "amount", "payment_date", "payment_method",
				"reference_number", "type", "description", "payment_group_id"
			)
			select gen_random_uuid(), d."lease_id", d."due", ${params.paymentDate},
				${params.paymentMethods}, ${params.referenceNumber},
				${PAYMENT_TYPES.RENT}, ${params.description}, g."id"
			from dues d
			join inserted_group g on true
			where d."due" > 0
			returning "id"
		)
		select g."id" as "group_id",
			(select count(*)::int from inserted_payments) as "payment_count",
			v."lease_count" as "lease_count",
			v."all_positive" as "all_positive"
		from validation v
		left join inserted_group g on true
	`);
}

// B11 combined-bill settlement. The batch takes its locks in the same order the
// node transaction does — the lease row first, then each selected utility by
// id — so both drivers serialize combined and individual settlements against
// the same lock domains (B08/B10 precedent).
function combinedNeonLeaseLockQuery(db: BatchCapableDatabase, leaseId: string) {
	return db.execute(sql`
		select ${settlementAdvisoryLock("lease", leaseId)}
	`);
}

function combinedNeonUtilityLockQuery(
	db: BatchCapableDatabase,
	leaseId: string,
	utilityIdList: SQL,
) {
	// Key construction mirrors settlementAdvisoryLock("utility", id) so this
	// serializes with individual utility settlements on the same domain.
	return db.execute(sql`
		select pg_advisory_xact_lock(
			hashtextextended('rently:settlement:utility:' || u."id"::text, 0)
		)
		from ${utilities} u
		where u."lease_id" = ${leaseId} and u."id" in (${utilityIdList})
		order by u."id"
	`);
}

function combinedNeonInsertQuery(
	db: BatchCapableDatabase,
	params: {
		agreementId: string;
		leaseId: string;
		groupId: string;
		utilityIdList: SQL;
		requestedCount: number;
		paymentDate: Date;
		paymentMethods: string | null;
		referenceNumber: string | null;
		description: string | null;
		idempotencyKey: string | null;
		requestFingerprint: string;
	},
) {
	// The rent due expression is the C08 period outstanding (rentOutstandingSql,
	// charges − allocations); the utility due expression still mirrors
	// getAmountDueForUtility (utilities have no period ledger): server-derived
	// balances computed from committed rows inside the same statement, with the
	// group and allocation inserts gated on the validation predicate. The rent
	// leg is optional — included only when outstanding rent is positive; every
	// named utility must be positive or nothing is written.
	return db.execute<{ group_id: string | null; payment_count: number }>(sql`
		with rent_due as materialized (
			select ${rentOutstandingSql()} as "due"
			from ${leases} l
			where l."id" = ${params.leaseId}
		),
		utility_dues as materialized (
			select u."id",
				u."total_amount"
				+ coalesce((
					select sum(c."amount")
					from ${billCredits} c
					where c."utility_id" = u."id"
				), 0)
				- coalesce((
					select sum(p."amount")
					from ${payments} p
					where p."utility_id" = u."id"
				), 0) as "due"
			from ${utilities} u
			where u."lease_id" = ${params.leaseId}
				and u."id" in (${params.utilityIdList})
		),
		validation as materialized (
			select
				(select "due" from rent_due) as "rent_due",
				(select count(*)::int from utility_dues) as "utility_count",
				${params.requestedCount}::int as "requested_count",
				(select coalesce(bool_and("due" > 0), false) from utility_dues)
					as "utilities_positive"
		),
		inserted_group as (
			insert into ${paymentGroups} (
				"id", "agreement_id", "payment_date", "payment_method",
				"reference_number", "description", "idempotency_key",
				"request_fingerprint"
			)
			select ${params.groupId}, ${params.agreementId}, ${params.paymentDate},
				${params.paymentMethods}, ${params.referenceNumber},
				${params.description}, ${params.idempotencyKey},
				${params.requestFingerprint}
			from validation
			where validation."utility_count" = validation."requested_count"
				and validation."utilities_positive"
			returning "id"
		),
		inserted_payments as (
			insert into ${payments} (
				"id", "lease_id", "amount", "payment_date", "payment_method",
				"reference_number", "type", "description", "utility_id",
				"payment_group_id"
			)
			select gen_random_uuid(), ${params.leaseId}::uuid, v."rent_due",
				${params.paymentDate}::timestamp, ${params.paymentMethods},
				${params.referenceNumber}, ${PAYMENT_TYPES.RENT},
				${params.description}, NULL, g."id"
			from validation v
			join inserted_group g on true
			where v."rent_due" > 0
			union all
			select gen_random_uuid(), ${params.leaseId}::uuid, d."due",
				${params.paymentDate}::timestamp, ${params.paymentMethods},
				${params.referenceNumber}, ${PAYMENT_TYPES.UTILITY},
				${params.description}, d."id", g."id"
			from utility_dues d
			join inserted_group g on true
			where d."due" > 0
			returning "id"
		),
		updated_utilities as (
			update ${utilities} u
			set "is_paid" = true, "updated_at" = now()
			from utility_dues d
			where u."id" = d."id"
				and exists (select 1 from inserted_group)
			returning u."id"
		)
		select g."id" as "group_id",
			(select count(*)::int from inserted_payments) as "payment_count"
		from validation v
		left join inserted_group g on true
	`);
}

// Create a single payment group for a combined agreement. Each active lease is
// allocated its complete currently-outstanding rent, preventing arbitrary or
// cross-unit splits while multi-unit partial-payment rules remain out of scope.
export const createAgreementPayment = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/create-agreement-payment",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateAgreementPaymentSchema)
	.output(
		z.object({
			paymentGroup: PaymentGroupSelectSchema,
			payments: z.array(PaymentSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		assertMethodAllowedForRole(input.paymentMethods, "owner");

		const [agreement] = await db
			.select({
				id: leaseAgreements.id,
				arrangementType: leaseAgreements.arrangementType,
			})
			.from(leaseAgreements)
			.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
			.where(
				and(
					eq(leaseAgreements.id, input.agreementId),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);
		if (!agreement) {
			throw new ORPCError("NOT_FOUND", {
				message: "Agreement not found or you do not own it",
			});
		}
		if (agreement.arrangementType !== LEASE_AGREEMENT_ARRANGEMENT.COMBINED) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Grouped payments are only available for combined agreements",
			});
		}

		// Idempotency: replay before any balance math — after a first success
		// the dues are zero, so a retry must hit this before allocations.
		const idempotencyKey = input.idempotencyKey ?? null;
		const requestFingerprint = groupedPaymentRequestFingerprint(input);
		if (idempotencyKey) {
			const replay = await findGroupedPaymentReplay(
				db,
				authUser.id,
				agreement.id,
				idempotencyKey,
				requestFingerprint,
			);
			if (replay) return replay;
		}

		const agreementLeases = await db
			.select({ id: leases.id })
			.from(leases)
			.where(
				and(eq(leases.agreementId, agreement.id), eq(leases.status, "active")),
			);
		if (agreementLeases.length < 2) {
			throw new ORPCError("BAD_REQUEST", {
				message: "A combined agreement requires at least two active leases",
			});
		}

		const groupId = crypto.randomUUID();
		const groupValues = {
			id: groupId,
			agreementId: agreement.id,
			paymentDate: input.paymentDate,
			paymentMethods: input.paymentMethods ?? null,
			referenceNumber: input.referenceNumber ?? null,
			description: input.description ?? null,
			idempotencyKey,
			requestFingerprint,
		};

		// B10: settlement protection comes first, then allocation math. The
		// active-lease set and every due are (re)computed inside the locked
		// operation below; balances read before the lock are stale by
		// construction and must never be written.
		let expectedAllocations = 0;

		if (supportsBatch(db)) {
			const insertQuery = groupedNeonInsertQuery(db, {
				agreementId: agreement.id,
				groupId,
				paymentDate: input.paymentDate,
				paymentMethods: input.paymentMethods ?? null,
				referenceNumber: input.referenceNumber ?? null,
				description: input.description ?? null,
				idempotencyKey,
				requestFingerprint,
			});
			try {
				const [, , result] = await db.batch([
					groupedNeonLockQuery(db, agreement.id),
					// C08: accrue BEFORE the insert so the dues CTE sees the full
					// charge set (idempotent; a refused insert leaves correct
					// charges and allocates nothing).
					db.execute(ensureAccruedChargesSql({ agreementId: agreement.id })),
					insertQuery,
					db.execute(
						allocateRentPaymentsSql(sql`p."payment_group_id" = ${groupId}`),
					),
					db.execute(
						reportUnallocatedRentPaymentRemaindersSql(
							sql`p."payment_group_id" = ${groupId}`,
						),
					),
				]);
				const [row] = result.rows;
				if (!row?.group_id) {
					// The validation gate suppressed the insert. A same-key winner
					// may have committed first (its settlement zeroes the dues);
					// adopt its group before reporting a balance error.
					if (idempotencyKey) {
						const replay = await findGroupedPaymentReplay(
							db,
							authUser.id,
							agreement.id,
							idempotencyKey,
							requestFingerprint,
						);
						if (replay) return replay;
					}
					if (row && row.lease_count < 2) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"A combined agreement requires at least two active leases",
						});
					}
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Every active unit must have an outstanding rent balance for an automatic split",
					});
				}
				expectedAllocations = row.payment_count;
			} catch (error) {
				if (violationCode(error) !== "23505" || !idempotencyKey) throw error;
				// Concurrent retry won the agreement-scoped group race. Query the
				// winner only through the authenticated owner and requested agreement.
				const replay = await findGroupedPaymentReplay(
					db,
					authUser.id,
					agreement.id,
					idempotencyKey,
					requestFingerprint,
				);
				if (replay) return replay;
				throw error;
			}
		} else {
			let txReplay:
				| Awaited<ReturnType<typeof findGroupedPaymentReplay>>
				| undefined;
			try {
				await db.transaction(async (tx) => {
					// Lock every active lease before reading any balance; the locking
					// read is also the authoritative post-lock active-lease set.
					const lockedLeases = await tx
						.select({ id: leases.id })
						.from(leases)
						.where(
							and(
								eq(leases.agreementId, agreement.id),
								eq(leases.status, "active"),
							),
						)
						.orderBy(leases.id)
						.for("update");
					if (lockedLeases.length < 2) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"A combined agreement requires at least two active leases",
						});
					}

					// A same-key winner may have committed while this transaction
					// waited on the locks; serve it before recomputing dues.
					if (idempotencyKey) {
						txReplay = await findGroupedPaymentReplay(
							tx,
							authUser.id,
							agreement.id,
							idempotencyKey,
							requestFingerprint,
						);
						if (txReplay) return;
					}

					// C08: accrue before computing dues so each lease's period
					// outstanding is complete (tx rollback keeps a failed
					// validation side-effect free).
					await tx.execute(
						ensureAccruedChargesSql({ agreementId: agreement.id }),
					);

					const allocations = await Promise.all(
						lockedLeases.map(async ({ id }) => ({
							leaseId: id,
							amount: (await getLeasePeriodDue(tx, id)).outstanding,
						})),
					);
					if (allocations.some(({ amount }) => amount <= 0)) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Every active unit must have an outstanding rent balance for an automatic split",
						});
					}

					expectedAllocations = allocations.length;
					await tx.insert(paymentGroups).values(groupValues);
					await tx.insert(payments).values(
						allocations.map(({ leaseId, amount }) => ({
							leaseId,
							amount,
							paymentDate: input.paymentDate,
							paymentMethods: input.paymentMethods ?? null,
							referenceNumber: input.referenceNumber ?? null,
							type: PAYMENT_TYPES.RENT,
							description: input.description ?? null,
							paymentGroupId: groupId,
						})),
					);

					// C08: charges were accrued before the dues computation; pour
					// the group's rent payments FIFO — same transaction.
					await tx.execute(
						allocateRentPaymentsSql(sql`p."payment_group_id" = ${groupId}`),
					);
					await tx.execute(
						reportUnallocatedRentPaymentRemaindersSql(
							sql`p."payment_group_id" = ${groupId}`,
						),
					);
				});
			} catch (error) {
				if (violationCode(error) !== "23505" || !idempotencyKey) throw error;
				const replay = await findGroupedPaymentReplay(
					db,
					authUser.id,
					agreement.id,
					idempotencyKey,
					requestFingerprint,
				);
				if (replay) return replay;
				throw error;
			}
			if (txReplay) return txReplay;
		}

		const [paymentGroup] = await db
			.select()
			.from(paymentGroups)
			.where(eq(paymentGroups.id, groupId));
		const createdPayments = await db
			.select()
			.from(payments)
			.where(eq(payments.paymentGroupId, groupId));
		try {
			await db.insert(notifications).values({
				userId: agreementLeases[0]
					? ((
							await db
								.select({ tenantId: leases.tenantId })
								.from(leases)
								.where(eq(leases.id, agreementLeases[0].id))
								.limit(1)
						)[0]?.tenantId ?? authUser.id)
					: authUser.id,
				type: "grouped_payment_received",
				title: "Combined payment recorded",
				message:
					"A payment was recorded for every unit in your combined agreement.",
				entityId: groupId,
				entityType: "payment_group",
			});
		} catch (error) {
			console.error("[payment:createAgreementPayment] notification failed", {
				groupId,
				error,
			});
		}
		if (!paymentGroup || createdPayments.length !== expectedAllocations) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record grouped payment",
			});
		}
		await sendAutomaticAgreementPaymentReceipt(db, authUser.id, groupId);

		return { paymentGroup, payments: createdPayments };
	});

// One atomic combined-bill settlement (B11): a single lease's outstanding rent
// plus its named unpaid utilities become one payment group, written entirely
// inside the settlement protection or not at all. Replaces the browser's
// parallel per-leg mutations, which could half-fail across legs.
export const createCombinedBillPayment = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/create-combined-bill-payment",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateCombinedBillPaymentSchema)
	.output(
		z.object({
			paymentGroup: PaymentGroupSelectSchema,
			payments: z.array(PaymentSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		assertMethodAllowedForRole(input.paymentMethods, "owner");

		if (new Set(input.utilityIds).size !== input.utilityIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Duplicate utility bills in the combined payment request",
			});
		}

		// One scoped lookup resolves the lease, the owner boundary, and the
		// payment-group parent. Current writers always create an agreement
		// (legacy rows were backfilled); a missing one fails loudly instead of
		// inferring a parent.
		const [leaseRow] = await db
			.select({ id: leases.id, agreementId: leases.agreementId })
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(eq(leases.id, input.leaseId), eq(properties.ownerId, authUser.id)),
			)
			.limit(1);
		if (!leaseRow) {
			throw new ORPCError("NOT_FOUND", {
				message: "Lease not found or you do not own it",
			});
		}
		const agreementId = leaseRow.agreementId;
		if (!agreementId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Lease has no agreement record for grouped payments",
			});
		}

		// Idempotency replay before any balance math — a retry after success
		// must return the committed group, not recompute zeroed dues.
		const idempotencyKey = input.idempotencyKey;
		const requestFingerprint = combinedBillRequestFingerprint({
			agreementId,
			leaseId: leaseRow.id,
			utilityIds: input.utilityIds,
			paymentDate: input.paymentDate,
			paymentMethods: input.paymentMethods ?? null,
			referenceNumber: input.referenceNumber ?? null,
			description: input.description ?? null,
		});
		const replay = await findGroupedPaymentReplay(
			db,
			authUser.id,
			agreementId,
			idempotencyKey,
			requestFingerprint,
		);
		if (replay) return replay;

		const groupId = crypto.randomUUID();
		const groupValues = {
			id: groupId,
			agreementId,
			paymentDate: input.paymentDate,
			paymentMethods: input.paymentMethods ?? null,
			referenceNumber: input.referenceNumber ?? null,
			description: input.description ?? null,
			idempotencyKey,
			requestFingerprint,
		};
		const utilityIdList = sql.join(
			input.utilityIds.map((id) => sql`${id}`),
			sql`, `,
		);

		// B10/B11: settlement protection comes first, then allocation math.
		// Rent and utility dues are recomputed inside the locked operation;
		// balances read before the lock are stale by construction.
		let expectedAllocations = 0;

		if (supportsBatch(db)) {
			try {
				const [, , , result] = await db.batch([
					combinedNeonLeaseLockQuery(db, leaseRow.id),
					combinedNeonUtilityLockQuery(db, leaseRow.id, utilityIdList),
					// C08: accrue BEFORE the insert so the rent_due CTE sees the
					// full charge set (idempotent; a refused insert leaves correct
					// charges and allocates nothing). Rent leg only — utility legs
					// never touch the rent ledger.
					db.execute(ensureAccruedChargesSql({ leaseId: leaseRow.id })),
					combinedNeonInsertQuery(db, {
						agreementId,
						leaseId: leaseRow.id,
						groupId,
						utilityIdList,
						requestedCount: input.utilityIds.length,
						paymentDate: input.paymentDate,
						paymentMethods: input.paymentMethods ?? null,
						referenceNumber: input.referenceNumber ?? null,
						description: input.description ?? null,
						idempotencyKey,
						requestFingerprint,
					}),
					db.execute(
						allocateRentPaymentsSql(
							sql`p."payment_group_id" = ${groupId} AND p."type" = 'rent'`,
						),
					),
					db.execute(
						reportUnallocatedRentPaymentRemaindersSql(
							sql`p."payment_group_id" = ${groupId}`,
						),
					),
				]);
				const [row] = result.rows;
				if (!row?.group_id) {
					// The validation gate suppressed the insert. A same-key winner
					// may have committed first (its settlement zeroed the dues);
					// adopt its group before reporting a balance error.
					const winnerReplay = await findGroupedPaymentReplay(
						db,
						authUser.id,
						agreementId,
						idempotencyKey,
						requestFingerprint,
					);
					if (winnerReplay) return winnerReplay;
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Every selected utility must have an outstanding balance for a combined payment",
					});
				}
				expectedAllocations = row.payment_count;
			} catch (error) {
				if (violationCode(error) !== "23505") throw error;
				// Concurrent retry won the agreement-scoped group race. Query the
				// winner only through the authenticated owner and lease's agreement.
				const winnerReplay = await findGroupedPaymentReplay(
					db,
					authUser.id,
					agreementId,
					idempotencyKey,
					requestFingerprint,
				);
				if (winnerReplay) return winnerReplay;
				throw error;
			}
		} else {
			let txReplay:
				| Awaited<ReturnType<typeof findGroupedPaymentReplay>>
				| undefined;
			try {
				await db.transaction(async (tx) => {
					// Lock order: lease row first, then every selected utility by id
					// — the same order the Neon batch uses.
					await tx.execute(
						sql`select 1 from ${leases} where ${leases.id} = ${leaseRow.id} for update`,
					);

					// A same-key winner may have committed while this transaction
					// waited on the locks; serve it before recomputing dues.
					txReplay = await findGroupedPaymentReplay(
						tx,
						authUser.id,
						agreementId,
						idempotencyKey,
						requestFingerprint,
					);
					if (txReplay) return;

					const lockedUtilities = await tx
						.select({ id: utilities.id })
						.from(utilities)
						.where(
							and(
								eq(utilities.leaseId, leaseRow.id),
								inArray(utilities.id, input.utilityIds),
							),
						)
						.orderBy(utilities.id)
						.for("update");
					if (lockedUtilities.length !== input.utilityIds.length) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Every selected utility must belong to this lease for a combined payment",
						});
					}

					// C08: accrue before computing dues so the rent leg uses the
					// complete period outstanding (tx rollback keeps a failed
					// validation side-effect free).
					await tx.execute(ensureAccruedChargesSql({ leaseId: leaseRow.id }));

					const rentDue = (await getLeasePeriodDue(tx, leaseRow.id))
						.outstanding;
					const utilityDues: Array<{ utilityId: string; amount: number }> = [];
					for (const { id } of lockedUtilities) {
						const due = await getAmountDueForUtility(tx, id);
						if (due <= 0) {
							throw new ORPCError("BAD_REQUEST", {
								message:
									"Every selected utility must have an outstanding balance for a combined payment",
							});
						}
						utilityDues.push({ utilityId: id, amount: due });
					}

					// The rent leg is conditional by design — a combined bill with
					// rent already settled records only the utilities.
					expectedAllocations = (rentDue > 0 ? 1 : 0) + utilityDues.length;

					await tx.insert(paymentGroups).values(groupValues);
					await tx.insert(payments).values([
						...(rentDue > 0
							? [
									{
										leaseId: leaseRow.id,
										amount: rentDue,
										paymentDate: input.paymentDate,
										paymentMethods: input.paymentMethods ?? null,
										referenceNumber: input.referenceNumber ?? null,
										type: PAYMENT_TYPES.RENT,
										description: input.description ?? null,
										utilityId: null,
										paymentGroupId: groupId,
									},
								]
							: []),
						...utilityDues.map(({ utilityId, amount }) => ({
							leaseId: leaseRow.id,
							amount,
							paymentDate: input.paymentDate,
							paymentMethods: input.paymentMethods ?? null,
							referenceNumber: input.referenceNumber ?? null,
							type: PAYMENT_TYPES.UTILITY,
							description: input.description ?? null,
							utilityId,
							paymentGroupId: groupId,
						})),
					]);

					// The compatibility isPaid flag follows the derived due (zero
					// after these allocations), matching recordUtilityPayment.
					for (const { utilityId } of utilityDues) {
						await syncUtilityPaidFlag(tx, utilityId);
					}

					// C08: charges were accrued before the dues computation; pour
					// the rent leg only — utility legs never touch the rent ledger.
					await tx.execute(
						allocateRentPaymentsSql(
							sql`p."payment_group_id" = ${groupId} AND p."type" = 'rent'`,
						),
					);
					await tx.execute(
						reportUnallocatedRentPaymentRemaindersSql(
							sql`p."payment_group_id" = ${groupId}`,
						),
					);
				});
			} catch (error) {
				// The aborted transaction cannot be reused — converge outside it.
				if (violationCode(error) !== "23505") throw error;
				const winnerReplay = await findGroupedPaymentReplay(
					db,
					authUser.id,
					agreementId,
					idempotencyKey,
					requestFingerprint,
				);
				if (winnerReplay) return winnerReplay;
				throw error;
			}
			if (txReplay) return txReplay;
		}

		const { paymentGroup, payments: createdPayments } =
			await readGroupedPaymentResult(db, groupId);
		if (!paymentGroup || createdPayments.length !== expectedAllocations) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to record combined payment",
			});
		}

		// One receipt for the whole group, only after the settlement committed.
		// Replays return before this point, so retries never re-email.
		await sendAutomaticAgreementPaymentReceipt(db, authUser.id, groupId);

		return { paymentGroup, payments: createdPayments };
	});

// Update — financial fields (amount, type, utilityId, leaseId) are immutable;
// only non-accounting metadata may change after a payment exists.
export const updatePayment = ownerProcedure
	.route({ method: "PATCH", path: "/rent/payment/update" })
	.input(z.object({ id: z.string(), data: UpdatePaymentSchema }))
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const existing = await getOwnedPayment(db, input.id, authUser.id);

		if (existing.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot update a reversal payment",
			});
		}

		// Recheck role restriction
		if (input.data.paymentMethods) {
			assertMethodAllowedForRole(input.data.paymentMethods, "owner");
		}

		const [updated] = await db
			.update(payments)
			.set({
				...input.data,
				paymentDate: input.data.paymentDate
					? new Date(input.data.paymentDate)
					: undefined,
				updatedAt: new Date(),
			})
			.where(eq(payments.id, input.id))
			.returning();

		if (!updated) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment not found after update",
			});
		}
		return { payment: updated };
	});

// GetById
export const getPaymentById = ownerProcedure
	.route({ method: "GET", path: "/rent/payment/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ payment: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const row = await getOwnedPayment(db, input.id, authUser.id);
		const { ownerId: _ownerId, ...payment } = row;

		return { payment };
	});

// GetAll
export const listPayments = ownerProcedure
	.route({ method: "GET", path: "/rent/payment/list" })
	.output(z.object({ payments: z.array(PaymentListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				id: payments.id,
				leaseId: payments.leaseId,
				amount: payments.amount,
				paymentDate: payments.paymentDate,
				paymentMethods: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				type: payments.type,
				description: payments.description,
				utilityId: payments.utilityId,
				createdAt: payments.createdAt,
				updatedAt: payments.updatedAt,
				paymentGroupId: payments.paymentGroupId,
				reversesPaymentId: payments.reversesPaymentId,
				tenantName: user.name,
				tenantPhone: tenantProfiles.phone,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.leftJoin(
				tenantProfiles,
				and(
					eq(tenantProfiles.userId, user.id),
					eq(tenantProfiles.createdById, authUser.id),
					isNull(tenantProfiles.deletedAt),
				),
			)
			.where(
				and(
					eq(properties.ownerId, authUser.id),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			)
			.orderBy(
				desc(payments.paymentDate),
				desc(payments.createdAt),
				desc(payments.id),
			);

		return { payments: results };
	});

// Remove — void creates negative reversal, preserves utilityId, blocks duplicate void
export const voidPayment = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/void" })
	.input(z.object({ id: z.string(), reason: z.string().optional() }))
	.output(z.object({ reversal: PaymentSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const existing = await getOwnedPayment(db, input.id, authUser.id);

		if (existing.type === PAYMENT_TYPES.REVERSAL) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot void a reversal payment",
			});
		}
		if (existing.paymentGroupId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Use voidPaymentGroup to reverse a grouped payment",
			});
		}

		// Idempotent void: a retry after timeout (or a concurrent loser) gets
		// the existing reversal instead of an error. The unique partial index
		// on the link arbitrates genuine races below.
		const alreadyReversed = await findReversalByOriginal(db, existing.id);
		if (alreadyReversed) {
			return { reversal: alreadyReversed };
		}

		const utilityId = existing.utilityId;

		let reversal: typeof payments.$inferSelect | undefined;
		if (supportsBatch(db)) {
			try {
				const reversalId = await insertNeonPaymentReversal(db, {
					id: crypto.randomUUID(),
					leaseId: existing.leaseId,
					amount: -existing.amount,
					paymentDate: new Date(),
					description: input.reason ?? `Reversal of payment ${existing.id}`,
					referenceNumber: existing.id,
					utilityId,
					reversesPaymentId: existing.id,
				});
				if (reversalId) {
					[reversal] = await db
						.select()
						.from(payments)
						.where(eq(payments.id, reversalId))
						.limit(1);
				}
			} catch (error) {
				if (violationCode(error) !== "23505") throw error;
				const winner = await findReversalByOriginal(db, existing.id);
				if (!winner) throw error;
				reversal = winner;
			}
			if (utilityId && reversal) {
				await syncUtilityPaidFlag(db, utilityId);
			}
		} else {
			try {
				reversal = await db.transaction(async (tx) => {
					if (utilityId) {
						await tx.execute(
							sql`select 1 from ${utilities} where ${utilities.id} = ${utilityId} for update`,
						);
					} else {
						await tx.execute(
							sql`select 1 from ${leases} where ${leases.id} = ${existing.leaseId} for update`,
						);
					}
					const existingReversal = await findReversalByOriginal(
						tx,
						existing.id,
					);
					if (existingReversal) return existingReversal;

					const [reversalRow] = await tx
						.insert(payments)
						.values({
							id: crypto.randomUUID(),
							leaseId: existing.leaseId,
							amount: -existing.amount,
							paymentDate: new Date(),
							type: PAYMENT_TYPES.REVERSAL,
							description: input.reason ?? `Reversal of payment ${existing.id}`,
							referenceNumber: existing.id,
							utilityId,
							reversesPaymentId: existing.id,
						})
						.returning();

					if (utilityId) {
						await syncUtilityPaidFlag(tx, utilityId);
					}

					// C04 dual-write: undo the original's period allocations.
					if (reversalRow) {
						await tx.execute(
							mirrorPaymentReversalSql(reversalRow.id, existing.id),
						);
					}

					return reversalRow;
				});
			} catch (error) {
				// The aborted transaction cannot be reused — converge outside it.
				if (violationCode(error) !== "23505") throw error;
				const winner = await findReversalByOriginal(db, existing.id);
				if (!winner) throw error;
				reversal = winner;
				if (utilityId) {
					await syncUtilityPaidFlag(db, utilityId);
				}
			}
		}

		if (!reversal) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create reversal",
			});
		}

		return { reversal };
	});

// Reverse all allocations in one grouped operation. Grouped payments must not be
// reversed individually because that would make the shared payment record lie
// about which units were settled.
export const voidPaymentGroup = ownerProcedure
	.route({ method: "DELETE", path: "/rent/payment/void-group" })
	.input(z.object({ id: z.uuid(), reason: z.string().optional() }))
	.output(
		z.object({
			paymentGroup: PaymentGroupSelectSchema,
			reversals: z.array(PaymentSelectSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		const [originalGroup] = await db
			.select({
				id: paymentGroups.id,
				agreementId: paymentGroups.agreementId,
				paymentMethods: paymentGroups.paymentMethods,
				referenceNumber: paymentGroups.referenceNumber,
				description: paymentGroups.description,
				reversesPaymentGroupId: paymentGroups.reversesPaymentGroupId,
			})
			.from(paymentGroups)
			.innerJoin(
				leaseAgreements,
				eq(paymentGroups.agreementId, leaseAgreements.id),
			)
			.innerJoin(properties, eq(leaseAgreements.propertyId, properties.id))
			.where(
				and(
					eq(paymentGroups.id, input.id),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);
		if (!originalGroup) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment group not found or you do not own it",
			});
		}
		if (originalGroup.reversesPaymentGroupId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot reverse a reversal group",
			});
		}

		const originalPayments = await db
			.select({
				id: payments.id,
				leaseId: payments.leaseId,
				amount: payments.amount,
				utilityId: payments.utilityId,
			})
			.from(payments)
			.where(eq(payments.paymentGroupId, originalGroup.id));
		if (originalPayments.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment group has no allocations to reverse",
			});
		}

		// Idempotent group void: a retry (or concurrent loser) gets the
		// existing complete reversal. A partial reversal group (crashed batch)
		// is never served silently — it needs manual repair.
		const existingReversal = await findReversalGroup(db, originalGroup.id);
		if (existingReversal) {
			return returnCompleteGroupReversal(
				db,
				originalPayments,
				existingReversal,
			);
		}

		const reversalGroupId = crypto.randomUUID();
		const paymentDate = new Date();
		const reversalGroupValues = {
			id: reversalGroupId,
			agreementId: originalGroup.agreementId,
			paymentDate,
			paymentMethods: originalGroup.paymentMethods,
			referenceNumber: originalGroup.referenceNumber,
			description:
				input.reason ?? `Reversal of payment group ${originalGroup.id}`,
			reversesPaymentGroupId: originalGroup.id,
		};
		const reversalValues = originalPayments.map((payment) => ({
			leaseId: payment.leaseId,
			amount: -payment.amount,
			paymentDate,
			paymentMethods: originalGroup.paymentMethods,
			referenceNumber: payment.id,
			type: PAYMENT_TYPES.REVERSAL,
			description: input.reason ?? `Reversal of payment ${payment.id}`,
			utilityId: payment.utilityId,
			paymentGroupId: reversalGroupId,
			reversesPaymentId: payment.id,
		}));

		if (supportsBatch(db)) {
			try {
				await db.batch([
					db.insert(paymentGroups).values(reversalGroupValues),
					...reversalValues.map((values) => db.insert(payments).values(values)),
					// C04 dual-write: the group's reversals undo the originals'
					// period allocations.
					db.execute(mirrorPaymentGroupReversalsSql(reversalGroupId)),
				]);
			} catch (error) {
				if (violationCode(error) !== "23505") throw error;
				const winner = await findReversalGroup(db, originalGroup.id);
				if (!winner) throw error;
				return returnCompleteGroupReversal(db, originalPayments, winner);
			}
		} else {
			try {
				await db.transaction(async (tx) => {
					await tx.insert(paymentGroups).values(reversalGroupValues);
					await tx.insert(payments).values(reversalValues);

					// C04 dual-write: the group's reversals undo the originals'
					// period allocations.
					await tx.execute(mirrorPaymentGroupReversalsSql(reversalGroupId));
				});
			} catch (error) {
				// The aborted transaction cannot be reused — converge outside it.
				if (violationCode(error) !== "23505") throw error;
				const winner = await findReversalGroup(db, originalGroup.id);
				if (!winner) throw error;
				return returnCompleteGroupReversal(db, originalPayments, winner);
			}
		}

		const [paymentGroup] = await db
			.select()
			.from(paymentGroups)
			.where(eq(paymentGroups.id, reversalGroupId));
		const reversals = await db
			.select()
			.from(payments)
			.where(eq(payments.paymentGroupId, reversalGroupId));
		if (!paymentGroup || reversals.length !== reversalValues.length) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to reverse grouped payment",
			});
		}

		await syncGroupUtilityFlags(db, originalPayments);

		return { paymentGroup, reversals };
	});

export const sendPaymentReceipt = ownerProcedure
	.route({ method: "POST", path: "/rent/payment/send-receipt" })
	.input(z.object({ paymentId: z.string().min(1) }))
	.output(z.object({ sent: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		if (!workspaceCapabilities(authUser).outboundCommunication) {
			return { sent: false };
		}

		// single query for ownership check AND data retrieval.
		// The innerJoin on properties.ownerId already enforces authorization —
		// if this payment doesn't belong to the owner, the result is empty.
		const [result] = await db
			.select({
				amount: payments.amount,
				paymentGroupId: payments.paymentGroupId,
				paymentDate: payments.paymentDate,
				type: payments.type,
				paymentMethods: payments.paymentMethods,
				referenceNumber: payments.referenceNumber,
				tenantEmail: user.email,
				tenantName: user.name,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(
				and(
					eq(payments.id, input.paymentId),
					eq(properties.ownerId, authUser.id),
				),
			)
			.limit(1);

		if (!result) {
			throw new ORPCError("NOT_FOUND", {
				message: "Payment not found or you do not have access to it.",
			});
		}

		// Manual delivery uses the same specialized HTML template as automatic
		// receipts. The payment already happened; the receipt is independent of
		// the persistence transaction.
		if (result.paymentGroupId) {
			const allocations = await db
				.select({ unitNumber: units.unitNumber, amount: payments.amount })
				.from(payments)
				.innerJoin(leases, eq(payments.leaseId, leases.id))
				.innerJoin(units, eq(leases.unitId, units.id))
				.where(eq(payments.paymentGroupId, result.paymentGroupId));
			await sendAgreementPaymentReceiptEmail({
				to: result.tenantEmail,
				tenantName: result.tenantName,
				ownerName: authUser.name,
				propertyName: result.propertyName,
				paymentDate: result.paymentDate,
				paymentMethod: result.paymentMethods,
				referenceNumber: result.referenceNumber,
				allocations,
			});
		} else
			await sendPaymentReceiptEmail({
				to: result.tenantEmail,
				tenantName: result.tenantName,
				ownerName: authUser.name,
				propertyName: result.propertyName,
				unitNumber: result.unitNumber,
				amount: result.amount,
				paymentDate: result.paymentDate,
				paymentType: result.type,
				paymentMethod: result.paymentMethods,
				referenceNumber: result.referenceNumber,
			});

		return { sent: true };
	});
