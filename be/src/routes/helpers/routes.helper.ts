// Helpers Function

import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { leases, properties, units, user } from "@/db/schema";
import type { Ctx } from "@/types/types";

export async function isPropertyOwner(
  c: Ctx,
  ownerId: string,
  propertyId: string
): Promise<boolean> {
  const db = c.get("db");

  const found = await db.query.properties.findFirst({
    where: (p, { eq, and }) =>
      and(eq(p.id, propertyId), eq(p.ownerId, ownerId)),
  });
  return !!found;
}

export async function isUnitOwner(
  c: Ctx,
  ownerId: string,
  unitId: string
): Promise<boolean> {
  const db = c.get("db");

  const unit = await db.query.units.findFirst({
    where: (u, { eq }) => eq(u.id, unitId),
    with: {
      property: {
        columns: { id: true, ownerId: true },
      },
    },
  });

  return unit?.property?.ownerId === ownerId;
}

export async function isLeaseOwner(
  c: Ctx,
  ownerId: string,
  leaseId: string
): Promise<boolean> {
  const db = c.get("db");

  const lease = await db.query.leases.findFirst({
    where: (l, { eq }) => eq(l.id, leaseId),
    with: {
      unit: {
        with: {
          property: {
            columns: { ownerId: true },
          },
        },
      },
    },
  });

  return lease?.unit?.property?.ownerId === ownerId;
}

export const leaseQueries = {
  async getOwnerLeases(db: Database, ownerId: string) {
    return db
      .select({
        leaseId: leases.id,
        rent: leases.rent,
        deposit: leases.deposit,
        startDate: leases.startDate,
        endDate: leases.endDate,
        status: leases.status,
        propertyName: properties.name,
        unitNumber: units.unitNumber,
        tenantName: user.name,
        tenantEmail: user.email,
        tenantPhone: user.phone,
      })
      .from(leases)
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(user, eq(leases.tenantId, user.id))
      .where(eq(properties.ownerId, ownerId));
  },
  async getOwnerLeaseById(db: Database, ownerId: string, leaseId: string) {
    const result = await db
      .select({
        leaseId: leases.id,
        rent: leases.rent,
        deposit: leases.deposit,
        startDate: leases.startDate,
        endDate: leases.endDate,
        status: leases.status,
        propertyName: properties.name,
        propertyAddress: properties.address,
        unitNumber: units.unitNumber,
        tenantName: user.name,
        tenantEmail: user.email,
        tenantPhone: user.phone,
      })
      .from(leases)
      .leftJoin(units, eq(leases.unitId, units.id))
      .leftJoin(properties, eq(units.propertyId, properties.id))
      .leftJoin(user, eq(leases.tenantId, user.id))
      .where(and(eq(properties.ownerId, ownerId), eq(leases.id, leaseId)));

    return result[0] ?? null;
  },
};
