import { db } from "./db";
import { grantOnce } from "./credits";
import { rewardReferrer } from "./referral";
import { findPlan } from "./pricing";

const monthKey = () => new Date().toISOString().slice(0, 7);

/** One month of plan credits — at most once per user per calendar month. */
export async function grantPlanMonth(userId: string, planId: string, amountCents: number, ref: string) {
  const plan = findPlan(planId);
  if (!plan) return;
  const granted = await grantOnce({
    userId,
    amount: plan.monthlyCredits,
    type: "SUBSCRIPTION",
    note: `Monthly credits: ${plan.id}`,
    externalRef: `sq_plan_${userId}_${monthKey()}`,
  });
  if (granted) {
    await rewardReferrer(userId);
    await db.payment.upsert({
      where: { stripeRef: ref },
      create: { userId, stripeRef: ref, kind: "subscription", productId: plan.id, amountCents, currency: "usd", credits: plan.monthlyCredits },
      update: {},
    });
  }
}

