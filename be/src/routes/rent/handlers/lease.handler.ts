import { eq } from "drizzle-orm";
import { LEASE_STATUSES, UNIT_STATUSES } from "@/constants/rent-constants";
import { leases, units } from "@/db/schema";
import {
  isLeaseOwner,
  isUnitOwner,
  leaseQueries,
} from "@/routes/helpers/routes.helper";
import { CreateLeaseSchema, UpdateLeaseSchema } from "@/types/rent-types";
import type { Ctx } from "@/types/types";
import { badRequest, forbidden, notFound, success } from "@/utils";

export async function create(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const payload = await c.req.json(); // Tenant Data by Owner

  const parsed = CreateLeaseSchema.safeParse(payload);

  if (!parsed.success) return badRequest(c, "Invalid Lease Data", parsed.error);

  const data = parsed.data;

  const ownsUnit = await isUnitOwner(c, owner.id, data.unitId);
  if (!ownsUnit) return forbidden(c, "You don't own this unit");

  try {
    const [lease] = await db
      .insert(leases)
      .values({
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate: data.startDate,
        endDate: data.endDate,
        rent: data.rent,
        deposit: data.deposit,
        status: data.status ?? LEASE_STATUSES.ACTIVE,
        referenceId: data.referenceId ?? null,
      })
      .returning();

    await db
      .update(units)
      .set({
        status: UNIT_STATUSES.OCCUPIED,
      })
      .where(eq(units.id, data.unitId));

    return success(c, { lease });
  } catch (error) {
    console.error("Error creating lease:", error);
    return badRequest(c, "Error creating lease");
  }
}

export async function update(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const payload = await c.req.json();
  const leaseId = c.req.param("id");

  const parsed = UpdateLeaseSchema.safeParse(payload);
  if (!parsed.success) return badRequest(c, "Invalid Lease Data", parsed.error);

  const updates = parsed.data;

  const ownsLease = await isLeaseOwner(c, owner.id, leaseId);
  if (!ownsLease) return forbidden(c, "You don't own this lease");

  try {
    const [updatedLease] = await db
      .update(leases)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(leases.id, leaseId))
      .returning();

    return success(c, { updatedLease });
  } catch (error) {
    console.error("Error updating lease:", error);
    return badRequest(c, "Error updating lease");
  }
}

// 3) lease getbyId

export async function getbyId(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const leaseId = c.req.param("id");

  try {
    const lease = await leaseQueries.getOwnerLeaseById(db, owner.id, leaseId);

    if (!lease) return notFound(c, "Lease not found");
    return success(c, { lease });
  } catch (error) {
    console.error("Error Getting leease", error);
    return badRequest(c, "Failed to get lease", error);
  }
}

// 4) Get All leases

export async function getAll(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");

  try {
    const list = await leaseQueries.getOwnerLeases(db, owner.id);

    if (!list.length) return notFound(c, "Leases Not found");
    return success(c, { leases: list });
  } catch (error) {
    console.error("Error Getting leases", error);
    return badRequest(c, "Failed to get leases", error);
  }
}

// 5) Delete Lease by Id

export async function remove(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const leaseId = c.req.param("id");

  const ownsLease = await isLeaseOwner(c, owner.id, leaseId);
  if (!ownsLease) return forbidden(c, "You don't own this lease");

  try {
    await db.delete(leases).where(eq(leases.id, leaseId));
    return success(c, { deleted: true });
  } catch (error) {
    console.error("Delete Error", error);
    return badRequest(c, "Deletion Failed", error);
  }
}
