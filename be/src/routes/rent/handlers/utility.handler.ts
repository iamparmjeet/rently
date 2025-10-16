import { eq } from "drizzle-orm";
import { FIXEDCHARGE, RATEPERUNIT } from "@/constants/payment-constants";
import { utilities } from "@/db/schema";
import { isLeaseOwner } from "@/routes/helpers/routes.helper";
import { CreateUtilitySchema, UpdateUtilitySchema } from "@/types/rent-types";
import type { Ctx } from "@/types/types";
import {
  badRequest,
  forbidden,
  notFound,
  safeHandler,
  safeJson,
  success,
} from "@/utils";

//create
export const create = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const payload = await safeJson(c);

  const parsed = CreateUtilitySchema.safeParse(payload);
  if (!parsed.success) return badRequest(c, "Data is invalid", parsed.error);

  const data = parsed.data;

  const owns = await isLeaseOwner(c, owner.id, data.leaseId);
  if (!owns) return forbidden(c, "You do not own this lease");

  const total =
    (data.currentReading - data.previousReading) *
      (data.ratePerUnit ?? RATEPERUNIT) +
    (data.fixedCharge ?? FIXEDCHARGE);

  try {
    const utils = await db
      .insert(utilities)
      .values({
        leaseId: data.leaseId,
        utilityType: data.utilityType,
        readingDate: data.readingDate,
        ratePerUnit: data.ratePerUnit,
        unitsUsed: data.unitsUsed ?? data.currentReading - data.previousReading,
        previousReading: data.previousReading,
        currentReading: data.currentReading,
        fixedCharge: data.fixedCharge ?? FIXEDCHARGE,
        totalAmount: total,
        isPaid: data.isPaid ?? false,
      })
      .returning();

    return success(c, { utils });
  } catch (error) {
    console.error("Error creating utility", error);
    return badRequest(c, "Failed to create Utility", error);
  }
});

// update
export const update = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const utilityId = c.req.param("id");
  const payload = await safeJson(c);

  const parsed = UpdateUtilitySchema.safeParse(payload);
  if (!parsed.success)
    return badRequest(c, "Invalid Utility Data", parsed.error);
  const data = parsed.data;

  const existing = await db.query.utilities.findFirst({
    where: (u, { eq }) => eq(u.id, utilityId),
  });
  if (!existing) return notFound(c, "Utility entry not found");

  const ownsLease = await isLeaseOwner(c, owner.id, existing.leaseId);
  if (!ownsLease) return forbidden(c, "You do not own this lease");

  // 🧮 Correct parentheses and member names
  const total =
    (Number(data.currentReading ?? existing.currentReading) -
      Number(data.previousReading ?? existing.previousReading)) *
      (data.ratePerUnit ?? existing.ratePerUnit ?? RATEPERUNIT) +
    (data.fixedCharge ?? existing.fixedCharge ?? FIXEDCHARGE);

  try {
    const [updated] = await db
      .update(utilities)
      .set({
        ...data,
        totalAmount: total,
        updatedAt: new Date(),
      })
      .where(eq(utilities.id, utilityId))
      .returning();

    return success(c, { utility: updated });
  } catch (error) {
    console.error("Error updating utility:", error);
    return badRequest(c, "Failed to update utility", error);
  }
});

// getById
export const getById = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const utilityId = c.req.param("id");

  try {
    const utility = await db.query.utilities.findFirst({
      where: (u, { eq }) => eq(u.id, utilityId),
      with: {
        lease: {
          with: {
            unit: {
              with: {
                property: true,
              },
            },
          },
        },
      },
    });
    if (!utility) return notFound(c, "Utility entry not found");
    const ownsLease = await isLeaseOwner(c, owner.id, utility.leaseId);
    if (!ownsLease) return forbidden(c, "you do not own this lease");
    return success(c, { utility });
  } catch (error) {
    console.error("Error retrieving utility", error);
    return badRequest(c, "Failed to get Utility", error);
  }
});

// getAll
export const getAll = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");

  try {
    const list = await db.query.utilities.findMany({
      with: {
        lease: {
          with: {
            unit: {
              with: {
                property: true,
              },
            },
          },
        },
      },
    });
    const ownerUtilities = list.filter(
      (u) => u.lease.unit.property.ownerId === owner.id
    );

    if (!ownerUtilities.length) return notFound(c, "No utilities found");
    return success(c, { utilities: ownerUtilities });
  } catch (error) {
    console.error("Error Fetching utilities", error);
    return badRequest(c, "Failed to fetch utilities", error);
  }
});

// remove
export const remove = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const utilityId = c.req.param("id");

  const record = await db.query.utilities.findFirst({
    where: (u, { eq }) => eq(u.id, utilityId),
  });
  if (!record) return notFound(c, "Utility not found");

  const ownsLease = await isLeaseOwner(c, owner.id, record.leaseId);
  if (!ownsLease) return forbidden(c, "You do not own this lease");

  try {
    await db.delete(utilities).where(eq(utilities.id, utilityId));
    return success(c, { deleted: true });
  } catch (error) {
    console.error("Error deleting utility:", error);
    return badRequest(c, "Failed to delete utility", error);
  }
});
