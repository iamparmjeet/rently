import { ORPCError } from "@orpc/server";
import { user as authUserTable } from "@rently/db/schema/auth";
import { billStatements } from "@rently/db/schema/schema";
import {
	BillStatementIdSchema,
	BillStatementSchema,
	IssueBillStatementSchema,
} from "@rently/validators";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { ownerProcedure } from "../../procedures";
import { getOwnedUtility } from "../helpers/owned-utility";
import { getLeasePeriodBalances } from "../helpers/period-balance";
import { getLocalPeriodKey } from "../helpers/rent-cycle";

// H01: printable statements live for 7 days — long enough to print/share,
// short enough that a stale link cannot circulate as a current bill.
const BILL_STATEMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function billNumber(statementId: string): string {
	return `KQ-CMB-${statementId.replaceAll("-", "").slice(-12).toUpperCase()}`;
}

// Lock a printable composition: one owner, one lease, one month. Amounts are
// never accepted — the read computes them from the locked bill set.
export const issueBillStatement = ownerProcedure
	.route({ method: "POST", path: "/rent/statement/issue" })
	.input(IssueBillStatementSchema)
	.output(z.object({ id: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const seen = new Set<string>();
		const resolved = [];
		for (const utilityId of input.utilityIds) {
			if (seen.has(utilityId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Duplicate utility bills in the statement request",
				});
			}
			seen.add(utilityId);
			// Owner-scoped with live-resource filters: unknown, foreign, or
			// archived bills refuse here with NOT_FOUND/FORBIDDEN.
			const { ownerId: _ownerId, ...utility } = await getOwnedUtility(
				db,
				utilityId,
				user.id,
			);
			resolved.push(utility);
		}

		const leaseIds = new Set(resolved.map((bill) => bill.leaseId));
		if (leaseIds.size !== 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "A printable statement covers one lease only",
			});
		}
		const periodKeys = new Set(
			resolved.map((bill) =>
				getLocalPeriodKey(new Date(bill.currentReadingDate)),
			),
		);
		if (periodKeys.size !== 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "A printable statement covers one billing month only",
			});
		}

		const leaseId = resolved[0]?.leaseId;
		const periodKey = [...periodKeys][0];
		if (!leaseId || !periodKey) throw new ORPCError("INTERNAL_SERVER_ERROR");

		const [statement] = await db
			.insert(billStatements)
			.values({
				ownerId: user.id,
				leaseId,
				utilityIds: [...seen],
				periodKey,
				expiresAt: new Date(Date.now() + BILL_STATEMENT_TTL_MS),
			})
			.returning();

		if (!statement) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to issue bill statement",
			});
		}

		return { id: statement.id };
	});

// Read a statement: owner + expiry checked first (unknown, foreign, and
// expired ids all read as NOT_FOUND), then every amount resolved live from
// the locked bill set — the URL carries no money and no composition.
export const getBillStatement = ownerProcedure
	.route({ method: "GET", path: "/rent/statement/get" })
	.input(BillStatementIdSchema)
	.output(z.object({ statement: BillStatementSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [statement] = await db
			.select()
			.from(billStatements)
			.where(
				and(
					eq(billStatements.id, input.id),
					eq(billStatements.ownerId, user.id),
				),
			)
			.limit(1);

		if (!statement || statement.expiresAt <= new Date()) {
			throw new ORPCError("NOT_FOUND", {
				message: "Bill statement not found or expired",
			});
		}

		const resolved = [];
		for (const utilityId of statement.utilityIds) {
			try {
				const { ownerId: _ownerId, ...utility } = await getOwnedUtility(
					db,
					utilityId,
					user.id,
				);
				resolved.push(utility);
			} catch {
				throw new ORPCError("NOT_FOUND", {
					message: "Bill statement is no longer available",
				});
			}
		}

		const [ownerRow] = await db
			.select({ name: authUserTable.name })
			.from(authUserTable)
			.where(eq(authUserTable.id, user.id))
			.limit(1);
		const ownerName = ownerRow?.name ?? "Your Landlord";
		const withOwner = resolved.map((utility) => ({ ...utility, ownerName }));
		const first = withOwner[0];
		if (!first) {
			throw new ORPCError("NOT_FOUND", {
				message: "Bill statement has no bills",
			});
		}

		const [balance] = await getLeasePeriodBalances(db, [statement.leaseId]);
		const rentDue = balance?.totalRentDue ?? 0;
		const utilityTotalDue = withOwner.reduce(
			(sum, bill) => sum + Math.max(0, bill.amountDue),
			0,
		);

		return {
			statement: {
				id: statement.id,
				billNumber: billNumber(statement.id),
				leaseId: statement.leaseId,
				propertyName: first.propertyName,
				unitNumber: first.unitNumber,
				tenantName: first.tenantName,
				periodKey: statement.periodKey,
				expiresAt: statement.expiresAt,
				rentDue,
				utilityTotalDue,
				statementTotal: rentDue + utilityTotalDue,
				utilities: withOwner,
			},
		};
	});
