import { ORPCError } from "@orpc/client";
import { StatusPhrase } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { properties, units } from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";

export async function VerifyUnitOwnership(
	db: Database,
	userId: string,
	unitId: string,
): Promise<void> {
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(units)
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(units.id, unitId))
		.limit(1);

	if (!result) {
		throw new ORPCError(StatusPhrase.NOT_FOUND, {
			message: "Unit Not Found",
		});
	}
	if (result.ownerId !== userId) {
		throw new ORPCError(StatusPhrase.FORBIDDEN, {
			message: "You don't own this unit.",
		});
	}
}
