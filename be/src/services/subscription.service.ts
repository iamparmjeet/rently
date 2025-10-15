import { eq } from "drizzle-orm";
import {
  BILLING_INTERVAL,
  PAYMENT_STATUS,
  PLAN_STATUS,
} from "@/constants/payment-constats";
import type { Database } from "@/db";
import { invoices, subscriptions } from "@/db/schema";
import type { Plan } from "@/db/types";
import { addMonths } from "@/utils/dates";

export class SubscriptionService {
  constructor(private db: Database) {}

  async startTrial(userId: string) {
    const basic = await this.db.query.plans.findFirst({
      where: (p, { eq }) => eq(p.name, "Basic"),
    });
    if (!basic) throw new Error("Missing Basic Plan");

    const trialEndsAt = addMonths(new Date(), 2);

    return this.db.insert(subscriptions).values({
      userId,
      planId: basic.id,
      billingInterval: BILLING_INTERVAL.MONTHLY,
      status: PLAN_STATUS.TRIAL,
      trialEndsAt,
      nextBillingDate: trialEndsAt,
    });
  }

  async subscribePlan(
    userId: string,
    planId: string,
    billingInterval: BILLING_INTERVAL
  ) {
    const plan = (await this.db.query.plans.findFirst({
      where: (p, { eq }) => eq(p.id, planId),
    })) as Plan | null;

    if (!plan) throw new Error("Invalid plan");

    const discount = this.getDiscount(billingInterval, plan);
    const months = this.getMonthsByInterval(billingInterval);
    const amount = plan.priceMonthly * months * (1 - discount);

    const start = new Date();
    const end = addMonths(start, months);

    const [invoice] = await this.db
      .insert(invoices)
      .values({
        userId,
        subscriptionId: planId,
        amount,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        paymentStatus: PAYMENT_STATUS.PENDING,
      })
      .returning();

    // integrate payment provider for checkout
    // on success:
    await this.db
      .update(subscriptions)
      .set({
        planId,
        billingInterval,
        status: PLAN_STATUS.ACTIVE,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        nextBillingDate: end,
      })
      .where(eq(subscriptions.userId, userId));

    return { invoice, end };
  }

  private getDiscount(interval: BILLING_INTERVAL, plan: Plan): number {
    switch (interval) {
      case BILLING_INTERVAL.QUARTERLY:
        return plan.discountQuarterly ?? 0;
      case BILLING_INTERVAL.HALFYEAR:
        return plan.discountHalfYearly ?? 0;
      case BILLING_INTERVAL.YEAR:
        return plan.discountYearly ?? 0;
      case BILLING_INTERVAL.TWOYEAR:
        return plan.discountTwoYear ?? 0;
      default:
        return 0;
    }
  }

  private getMonthsByInterval(interval: BILLING_INTERVAL): number {
    switch (interval) {
      case BILLING_INTERVAL.QUARTERLY:
        return 3;
      case BILLING_INTERVAL.HALFYEAR:
        return 6;
      case BILLING_INTERVAL.YEAR:
        return 12;
      case BILLING_INTERVAL.TWOYEAR:
        return 24;
      default:
        return 1;
    }
  }
}
