// Plans the admin gives for free ("comp"): status "comp" until currentPeriodEnd, monthly credits added automatically.
import { db } from "./db";
import { grantOnce } from "./credits";
import { loadPricing } from "./pricing";

const month = () => new Date().toISOString().slice(0, 7);

export const isCompActive = (u: { subscriptionStatus: string | null; currentPeriodEnd: Date | null }) =>
  u.subscriptionStatus === "comp" && !!u.currentPeriodEnd && u.currentPeriodEnd.getTime() > Date.now();

/** Adds this month's plan credits once (called when a comp user visits the site). */
export async function topUpComp(u: { id: string; planId: string | null; subscriptionStatus: string | null; currentPeriodEnd: Date | null }) {
  if (!u.planId || !isCompActive(u)) return false;
  const plan = (await loadPricing()).plans.find((p) => p.id === u.planId);
  if (!plan) return false;
  return grantOnce({ userId: u.id, amount: plan.monthlyCredits, type: "SUBSCRIPTION", note: `Gift plan ${plan.name}: monthly credits`, externalRef: `comp_${u.id}_${month()}` });
}

/** Admin: give (or remove) a free plan for N months. */
export async function setCompPlan(userId: string, planId: string | null, months: number) {
  if (!planId) {
    await db.user.update({ where: { id: userId }, data: { planId: null, subscriptionStatus: null, currentPeriodEnd: null } });
    return;
  }
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, Math.min(36, months)));
  const u = await db.user.update({ where: { id: userId }, data: { planId, subscriptionStatus: "comp", currentPeriodEnd: end } });
  await topUpComp(u);
}
