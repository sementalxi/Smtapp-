// Plans the admin gives for free ("comp"): status "comp" until currentPeriodEnd, monthly credits added automatically.
import { db } from "./db";
import { grantOnce } from "./credits";
import { loadPricing } from "./pricing";
import { logGiftPlan } from "./discord-logs";

const month = () => new Date().toISOString().slice(0, 7);

export const isCompActive = (u: { subscriptionStatus: string | null; currentPeriodEnd: Date | null }) =>
  u.subscriptionStatus === "comp" && !!u.currentPeriodEnd && u.currentPeriodEnd.getTime() > Date.now();

/** Adds this month's plan credits once (called when a comp user visits the site). */
export async function topUpComp(u: { id: string; planId: string | null; subscriptionStatus: string | null; currentPeriodEnd: Date | null }, log = true) {
  if (!u.planId || !isCompActive(u)) return false;
  const plan = (await loadPricing()).plans.find((p) => p.id === u.planId);
  if (!plan) return false;
  const ok = await grantOnce({ userId: u.id, amount: plan.monthlyCredits, type: "SUBSCRIPTION", note: `Gift plan ${plan.name}: monthly credits`, externalRef: `comp_${u.id}_${month()}` });
  if (ok && log) await logGiftPlan({ userId: u.id, action: "monthly", planName: plan.name, credits: plan.monthlyCredits, until: u.currentPeriodEnd });
  return ok;
}

/** Admin: give (or remove) a free plan for N months. */
export async function setCompPlan(userId: string, planId: string | null, months: number) {
  if (!planId) {
    await db.user.update({ where: { id: userId }, data: { planId: null, subscriptionStatus: null, currentPeriodEnd: null } });
    await logGiftPlan({ userId, action: "removed" });
    return;
  }
  const end = new Date();
  end.setMonth(end.getMonth() + Math.max(1, Math.min(36, months)));
  const u = await db.user.update({ where: { id: userId }, data: { planId, subscriptionStatus: "comp", currentPeriodEnd: end } });
  const added = await topUpComp(u, false);
  const plan = (await loadPricing()).plans.find((p) => p.id === planId);
  await logGiftPlan({ userId, action: "given", planName: plan?.name ?? planId, credits: added ? plan?.monthlyCredits : undefined, until: end });
}
