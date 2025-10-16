import { payments, utilities } from "@/db/schema";
import { CreatePaymentSchema, UpdatePaymentSchema } from "@/types/rent-types";
import { PAYMENT_TYPES } from "@/constants/rent-constants";
import type { Ctx } from "@/types/types";
import { badRequest, forbidden, notFound, success } from "@/utils";
import { isLeaseOwner } from "@/routes/helpers/routes.helper";
import { eq } from "drizzle-orm";

// Create
export async function create(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const payload = await c.req.json();

  const parsed = CreatePaymentSchema.safeParse(payload);
  if (!parsed.success)
    return badRequest(c, "Invalid Payment Data", parsed.error);

  const data = parsed.data;

  // Ownership check
  const ownsLease = await isLeaseOwner(c, owner.id, data.leaseId);
  if (!ownsLease) return forbidden(c, "You do not own this lease");

  try {
    const [payment] = await db
      .insert(payments)
      .values({
        leaseId: data.leaseId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        type: data.type ?? PAYMENT_TYPES.RENT,
        description: data.description ?? null,
        utilityId: data.utilityId ?? null,
      })
      .returning();

    // If payment belongs to a utility → mark that utility as paid
    if (payment.utilityId) {
      await db
        .update(utilities)
        .set({ isPaid: true })
        .where(eq(utilities.id, payment.utilityId));
    }

    return success(c, { payment });
  } catch (error) {
    console.error("Error creating payment:", error);
    return badRequest(c, "Failed to record payment", error);
  }
}

// Update
export async function update(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const paymentId = c.req.param("id");
  const payload = await c.req.json();

  const parsed = UpdatePaymentSchema.safeParse(payload);
  if (!parsed.success)
    return badRequest(c, "Invalid Payment Data", parsed.error);

  const data = parsed.data;

  const existing = await db.query.payments.findFirst({
    where: (p, { eq }) => eq(p.id, paymentId),
  });
  if (!existing) return notFound(c, "Payment not found");

  const owns = await isLeaseOwner(c, owner.id, existing.leaseId);
  if (!owns) return forbidden(c, "You do not own this payment/lease");

  try {
    const [updated] = await db
      .update(payments)
      .set({
        amount: data.amount,
        paymentDate: new Date(),
        type: data.type,
        description: data.description ?? null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning();

    return success(c, { payment: updated });
  } catch (error) {
    console.error("Error updating payment:", error);
    return badRequest(c, "Failed to update payment", error);
  }
}

// GetById
export async function getById(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const paymentId = c.req.param("id");

  try {
    const payment = await db.query.payments.findFirst({
      where: (p, { eq }) => eq(p.id, paymentId),
      with: {
        lease: {
          with: { unit: { with: { property: true } } },
        },
        utility: true,
      },
    });

    if (!payment) return notFound(c, "Payment not found");
    if (payment.lease.unit.property.ownerId !== owner.id)
      return forbidden(c, "You do not own this payment");

    return success(c, { payment });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return badRequest(c, "Failed to get payment", error);
  }
}

// GetAll
export async function getAll(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");

  try {
    const list = await db.query.payments.findMany({
      with: {
        lease: { with: { unit: { with: { property: true } } } },
        utility: true,
      },
    });

    const ownerPayments = list.filter(
      (p) => p.lease.unit.property.ownerId === owner.id
    );

    if (!ownerPayments.length)
      return notFound(c, "No payments recorded for this owner");

    return success(c, { payments: ownerPayments });
  } catch (error) {
    console.error("Error listing payments:", error);
    return badRequest(c, "Failed to list payments", error);
  }
}

// Remove
export async function remove(c: Ctx) {
  const db = c.get("db");
  const owner = c.get("user");
  const paymentId = c.req.param("id");

  const existing = await db.query.payments.findFirst({
    where: (p, { eq }) => eq(p.id, paymentId),
  });
  if (!existing) return notFound(c, "Payment not found");

  const owns = await isLeaseOwner(c, owner.id, existing.leaseId);
  if (!owns) return forbidden(c, "You do not own this payment/lease");

  try {
    await db.delete(payments).where(eq(payments.id, paymentId));

    // If it was utility payment, mark utility unpaid again
    if (existing.utilityId) {
      await db
        .update(utilities)
        .set({ isPaid: false })
        .where(eq(utilities.id, existing.utilityId));
    }

    return success(c, { deleted: true });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return badRequest(c, "Failed to delete payment", error);
  }
}
