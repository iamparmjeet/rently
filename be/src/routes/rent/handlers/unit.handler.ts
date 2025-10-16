import { eq } from "drizzle-orm";
import { UNIT_STATUSES } from "@/constants/rent-constants";
import { properties, units } from "@/db/schema";
import { isPropertyOwner, isUnitOwner } from "@/routes/helpers/routes.helper";
import { CreateUnitSchmea, UpdateUnitSchema } from "@/types/rent-types";
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

  const parsed = CreateUnitSchmea.safeParse(payload);
  if (!parsed.success) return badRequest(c, "Invalid Data", parsed.error);

  const data = parsed.data;

  const ownsProperty = await isPropertyOwner(c, owner.id, data.propertyId);
  if (!ownsProperty) return forbidden(c, "You don't own this property");

  try {
    const [unit] = await db
      .insert(units)
      .values({
        ...data,
        status: UNIT_STATUSES.AVAILABLE,
      })
      .returning();

    return success(c, { unit });
  } catch (error) {
    console.error(error);
    return badRequest(c, "Failed to create unit");
  }
});

// update
export const update = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const unitId = c.req.param("id");
  const payload = await safeJson(c);

  const parsed = UpdateUnitSchema.safeParse(payload);
  if (!parsed.success) return badRequest(c, "Invalid Data", parsed.error);

  const data = parsed.data;

  const ownsUnit = await isUnitOwner(c, owner.id, unitId);
  if (!ownsUnit) return forbidden(c, "You don't own this unit");

  try {
    const [updated] = await db
      .update(units)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(units.id, unitId))
      .returning();

    if (!updated) return notFound(c, "Unit Not found");
    return success(c, { unit: updated });
  } catch (error) {
    console.error("Unit Update Error", error);
    return badRequest(c, "failed to Update unit", error);
  }
});

// getbyId
export const getById = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const unitId = c.req.param("id");

  const owns = await isUnitOwner(c, owner.id, unitId);
  if (!owns) return forbidden(c, "You don't own this unit");

  try {
    const unit = await db.query.units.findFirst({
      where: (u, { eq }) => eq(u.id, unitId),
      with: {
        property: {
          columns: {
            id: true,
            ownerId: true,
            name: true,
          },
        },
      },
    });
    if (!unit) return notFound(c, "Unit Not Found");
    return success(c, { unit });
  } catch (error) {
    console.error("Unit Get Error", error);
    return badRequest(c, "failed to get unit", error);
  }
});

// getAll
export const getAll = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");

  try {
    const unitsList = await db
      .select({
        id: units.id,
        unitNumber: units.unitNumber,
        type: units.type,
        area: units.area,
        baseRent: units.baseRent,
        status: units.status,
        propertyId: properties.id,
        propertyName: properties.name,
      })
      .from(units)
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.ownerId, owner.id));

    if (!unitsList.length) return notFound(c, "No Units Found for");

    return success(c, { units: unitsList });
  } catch (error) {
    console.error("Error Fetching units", error);
    return badRequest(c, "failed to fetch units", error);
  }
});

// remove
export const remove = safeHandler(async (c: Ctx) => {
  const db = c.get("db");
  const owner = c.get("user");
  const unitId = c.req.param("id");

  const ownsUnit = await isUnitOwner(c, owner.id, unitId);
  if (!ownsUnit) return forbidden(c, "You don't own this unit");

  try {
    await db.delete(units).where(eq(units.id, unitId));
    return success(c, { message: "Unit deleted successfully" });
  } catch (error) {
    console.error("Unit Delete Error", error);
    return badRequest(c, "failed to delete unit", error);
  }
});
