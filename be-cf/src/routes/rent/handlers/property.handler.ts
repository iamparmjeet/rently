import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { CreatePropertySchema, UpdatePropertySchema } from "@/types/rent-types";
import { badRequest, notFound, success } from "@/utils";

// Helpers Function

export const isOwner = async (
  userId: string,
  propertyId: string
): Promise<boolean> => {
  const found = await db.query.properties.findFirst({
    where: (prop, { eq, and }) =>
      and(eq(prop.id, propertyId), eq(prop.ownerId, userId)),
  });
  return !!found;
};

// 1) Create Property

export const create = async (c: Context) => {
  const user = c.get("user");
  const result = CreatePropertySchema.safeParse(await c.req.json());
  if (!result.success) {
    console.error(result.error);
    return badRequest(c);
  }

  const payload = result.data;

  try {
    const [property] = await db
      .insert(properties)
      .values({
        ownerId: user.id,
        name: payload.name,
        address: payload.address,
        type: payload.type,
      })
      .returning();

    return success(c, { property });
  } catch (err) {
    console.error("Property Create Error", err);
    return badRequest(c, "Failed to Create Property", err);
  }
};

// Get All

export const getAll = async (c: Context) => {
  const user = c.get("user");

  try {
    const list = await db.query.properties.findMany({
      where: (prop, { eq }) => eq(prop.ownerId, user.id),
    });

    return success(c, { properties: list });
  } catch (err) {
    console.error("Property List error", err);
    return badRequest(c, "Failed to Fetch Properties", err);
  }
};

// 3) Get Single Property By Id
//

export const getById = async (c: Context) => {
  const propertyId = c.req.param("id");

  const property = await db.query.properties.findFirst({
    where: (prop, { eq }) => eq(prop.id, propertyId),
  });

  if (!property) return notFound(c, "Property Not Found");

  return success(c, { property });
};

// 4) Update Property

export const update = async (c: Context) => {
  const propertyId = c.req.param("id");
  const result = UpdatePropertySchema.safeParse(await c.req.json());

  if (!result.success) {
    return badRequest(c, "Validation Failed", result.error);
  }

  const updates = result.data;

  try {
    const [updated] = await db
      .update(properties)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId))
      .returning();
    return success(c, { property: updated });
  } catch (err) {
    console.error("Error while Updating", err);
    return badRequest(c, "Updation Failed", err);
  }
};

// 5) Delete Property

export const remove = async (c: Context) => {
  const propertyId = c.req.param("id");

  try {
    await db.delete(properties).where(eq(properties.id, propertyId));
    return success(c, { deleted: true });
  } catch (err) {
    console.error("Delete Error", err);
    return badRequest(c, "Deletion Failed", err);
  }
};
