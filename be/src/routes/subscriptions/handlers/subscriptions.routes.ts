import { SubscriptionService } from "@/services/subscription.service";
import type { Ctx } from "@/types/types";
import { badRequest, success } from "@/utils";

export const startTrial = async (c: Ctx) => {
  const db = c.get("db");
  const user = c.get("user");
  const service = new SubscriptionService(db);

  try {
    const sub = await service.startTrial(user.id);
    return success(c, { subscription: sub });
  } catch (error) {
    console.error(error);
    return badRequest(c, "Failed to start trial");
  }
};

export const upgrade = async (c: Ctx) => {
  const db = c.get("db");
  const user = c.get("user");

  const { planId, billingInterval } = await c.req.json();
  const service = new SubscriptionService(db);

  try {
    const invoice = await service.subscribePlan(
      user.id,
      planId,
      billingInterval
    );
    return success(c, { invoice });
  } catch (error) {
    console.error("Upgrade Subscription Route", error);
    return badRequest(c, "Subscription Upgrade failed");
  }
};
