import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import {
	APPLIED_AS_VALUES,
	CREDIT_TYPE_VALUES,
} from "@rently/db/constants/payment-constants";
import { billCredits, utilities } from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner } from "../helpers";
import {
	getAmountDueForRent,
	getAmountDueForUtility,
} from "../helpers/credit.helpers";

// *********** Helper **********************
const getCreditNoteNo = (id: string) =>
	`KQ-CN-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;

// *********** Helper Ends **********************

// 1) Create Credit
export const createCredit = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/credit/create",
		successStatus: StatusCode.CREATED,
	})
	.input(
		z.object({
			leaseId: z.uuid(),
			utilityId: z.uuid().nullable().optional(), // null = rent/general
			type: z.enum(CREDIT_TYPE_VALUES),
			amount: z
				.number()
				.int()
				.negative({ error: "Amount must be negative (paise)" }),
			reason: z.string().min(10, { error: "Reason >= 10 chars" }).trim(),
			appliedAs: z.enum(APPLIED_AS_VALUES).default("adjust"),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		if (!(await isLeaseOwner(db, user.id, input.leaseId)))
			throw new ORPCError("FORBIDDEN");

		if (input.utilityId) {
			const [u] = await db
				.select({ leaseId: utilities.leaseId })
				.from(utilities)
				.where(eq(utilities.id, input.utilityId))
				.limit(1);
			if (!u || u.leaseId !== input.leaseId)
				throw new ORPCError("FORBIDDEN", {
					message: "Utility does not belong to lease",
				});
		}

		return db.transaction(async (tx) => {
			const due = input.utilityId
				? await getAmountDueForUtility(tx, input.utilityId)
				: await getAmountDueForRent(tx, input.leaseId);

			if (Math.abs(input.amount) > due)
				throw new ORPCError("BAD_REQUEST", {
					message: `Discount exceeds amountDue: ${due}`,
				});

			const id = generatedId(); // id.ts:10 uuidv7
			const creditNoteNo = getCreditNoteNo(id);

			const [row] = await tx
				.insert(billCredits)
				.values({
					id,
					leaseId: input.leaseId,
					utilityId: input.utilityId ?? null,
					ownerId: user.id,
					type: input.type,
					amount: input.amount,
					reason: input.reason,
					creditNoteNo,
					appliedAs: input.appliedAs,
					createdBy: user.id,
				})
				.returning();
			return { credit: row };
		});
	});

// 2) Reverse Credit
export const reverseCredit = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/credit/reverse",
	})
	.input(z.object({ creditId: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const [existing] = await db
			.select()
			.from(billCredits)
			.where(eq(billCredits.id, input.creditId))
			.limit(1);

		if (!existing) throw new ORPCError("NOT_FOUND");

		if (!(await isLeaseOwner(db, user.id, existing.leaseId)))
			throw new ORPCError("FORBIDDEN");

		if (existing.reversedAt)
			throw new ORPCError("CONFLICT", { message: "Already reversed" });
		const [updated] = await db
			.update(billCredits)
			.set({
				reversedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(billCredits.id, input.creditId))
			.returning();

		return { credit: updated };
	});

// 3) List Credits
export const listCredits = ownerProcedure
	.route({
		method: "GET",
		path: "/rent/credit/list",
	})
	.input(
		z.object({
			leaseId: z.uuid().optional(),
			utilityId: z.uuid().nullable().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const filters = [eq(billCredits.ownerId, user.id)];
		if (input.leaseId) filters.push(eq(billCredits.leaseId, input.leaseId));
		if (input.utilityId !== undefined) {
			filters.push(
				input.utilityId
					? eq(billCredits.utilityId, input.utilityId)
					: isNull(billCredits.utilityId),
			);
		}
		const credits = await db
			.select()
			.from(billCredits)
			.where(and(...filters))
			.orderBy(sql`${billCredits.createdAt} desc`);

		return { credits };
	});
