import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { ownerProfiles } from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import {
	OwnerProfileSelectSchema,
	UpsertOwnerProfileSchema,
} from "@rently/validators";
import { and, eq, isNull } from "drizzle-orm";
import z from "zod";

// 1) Get owner Profile
export const getOwnerProfile = ownerProcedure
	.route({ method: "GET", path: "/rent/owner-profile/get" })
	.output(z.object({ profile: OwnerProfileSelectSchema.nullable() }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const [profile] = await db
			.select()
			.from(ownerProfiles)
			.where(
				and(
					eq(ownerProfiles.userId, authUser.id),
					isNull(ownerProfiles.deletedAt),
				),
			)
			.limit(1);
		return { profile: profile ?? null };
	});

// 2) Upsert Owner Profile
export const upsertOwnerProfile = ownerProcedure
	.route({ method: "PUT", path: "/rent/owner-profile/upsert" })
	.input(UpsertOwnerProfileSchema)
	.output(z.object({ profile: OwnerProfileSelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Find existing profile first
		const [existing] = await db
			.select()
			.from(ownerProfiles)
			.where(
				and(eq(ownerProfiles.userId, user.id), isNull(ownerProfiles.deletedAt)),
			)
			.limit(1);

		if (existing) {
			// UPDATE path — merge input over existing values
			const [updated] = await db
				.update(ownerProfiles)
				.set({
					companyName: input.companyName ?? existing.companyName,
					address: input.address ?? existing.address,
					gstNumber: input.gstNumber ?? existing.gstNumber,
					gstEnabled: input.gstEnabled ?? existing.gstEnabled,
					gstRateRent: input.gstRateRent ?? existing.gstRateRent,
					gstRateMaintenance:
						input.gstRateMaintenance ?? existing.gstRateMaintenance,
					upiId: input.upiId ?? existing.upiId,
				})
				.where(eq(ownerProfiles.id, existing.id))
				.returning();

			if (!updated) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Profile update failed",
				});
			}

			return { profile: updated };
		}

		// INSERT path — first time saving business details
		const [created] = await db
			.insert(ownerProfiles)
			.values({
				id: generatedId(),
				userId: user.id,
				// WHY "" default: companyName is notNull in DB — we allow saving
				// without it in the UI and let the user fill it in later.
				companyName: input.companyName ?? "",
				address: input.address ?? null,
				gstNumber: input.gstNumber ?? null,
				gstEnabled: input.gstEnabled ?? false,
				gstRateRent: input.gstRateRent ?? 0,
				gstRateMaintenance: input.gstRateMaintenance ?? 0,
				upiId: input.upiId ?? null,
			})
			.returning();

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Profile creation failed",
			});
		}

		return { profile: created };
	});
