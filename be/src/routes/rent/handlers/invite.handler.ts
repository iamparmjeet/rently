import { eq } from "drizzle-orm";
import z from "zod";
import { USER_ROLES } from "@/constants/user-roles";
import { tenantInvites, user } from "@/db/schema";
import type { NewTenantInvite } from "@/db/types";
import type { Ctx } from "@/types/types";
import {
  addDays,
  badRequest,
  forbidden,
  generateUUID,
  notFound,
  now,
  StatusCode,
  safeError,
  sendError,
  success,
} from "@/utils";

const InviteRequestSchema = z.object({
  email: z.email(),
});

export async function handleCreateInvite(c: Ctx) {
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

export const handleAcceptInvite = async (c: Ctx) => {
  const body = await c.req.json();
  const { token, ...userData } = body; // User provides personal details + token

  const db = c.get("db");

  // Verify token exists and is valid
  const invite = await db.query.tenantInvites.findFirst({
    where: (inv, { eq, and, gt }) =>
      and(
        eq(inv.token, token),
        eq(inv.status, "pending"),
        gt(inv.expiresAt, new Date())
      ),
  });

  if (!invite) {
    return notFound(c, "Invalid or expired invitation");
  }

  // Create user with tenant role
  const [newUser] = await db
    .insert(user)
    .values({
      ...userData,
      role: USER_ROLES.TENANT,
      emailVerified: true,
    })
    .returning();

  // Update invite status
  await db
    .update(tenantInvites)
    .set({ status: "accepted" })
    .where(eq(tenantInvites.id, invite.id));

  return success(c, { user: newUser });
};
