import type { Context } from "hono";
import z from "zod";
import { USER_ROLES } from "@/constants/user-roles";
import { tenantInvites } from "@/db/schema";
import type { NewTenantInvite } from "@/db/types";
import {
  addDays,
  badRequest,
  forbidden,
  generateUUID,
  now,
  StatusCode,
  safeError,
  sendError,
  success,
} from "@/utils";

const InviteRequestSchema = z.object({
  email: z.email(),
});

export async function handleCreateInvite(c: Context) {
  const user = c.get("user"); // Here  user is coming from withAuthMiddleware

  if (
    !user ||
    (user.role !== USER_ROLES.OWNER && user.role !== USER_ROLES.ADMIN)
  ) {
    return forbidden(c);
  }

  const body = await c.req.json();
  const parsed = InviteRequestSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(c);
  }

  const { email } = parsed.data;

  const db = c.get("db");

  const token = generateUUID();
  const today = now();
  const expiresAt = addDays(today, 7);

  const newInvite: NewTenantInvite = {
    email,
    token,
    invitedById: user.id,
    expiresAt,
    status: "pending",
    createdAt: today,
  };

  try {
    await db.insert(tenantInvites).values(newInvite);
    return success(c);
  } catch (error) {
    console.error("Failed to create Invite", safeError(error));
    return sendError(
      c,
      "Failed to create Invite",
      StatusCode.INTERNAL_SERVER_ERROR
    );
  }
}
