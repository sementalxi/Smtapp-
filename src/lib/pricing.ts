// Credit packs (one-time) and subscription plans (monthly).
// Edit prices here. The matching Stripe products/prices are created
// automatically the first time someone buys (see getStripePriceId in stripe.ts).
// The env vars below are optional overrides if you prefer to manage prices yourself.

export interface CreditPack {
  id: "small" | "medium" | "large";
  credits: number;
  priceUsd: number;
  envKey: string;
  popular?: boolean;
}

export interface Plan {
  id: "starter" | "pro";
  monthlyCredits: number;
  priceUsd: number;
  envKey: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", credits: 10, priceUsd: 4.99, envKey: "STRIPE_PRICE_PACK_SMALL" },
  { id: "medium", credits: 30, priceUsd: 11.99, envKey: "STRIPE_PRICE_PACK_MEDIUM", popular: true },
  { id: "large", credits: 100, priceUsd: 29.99, envKey: "STRIPE_PRICE_PACK_LARGE" },
];

export const PLANS: Plan[] = [
  { id: "starter", monthlyCredits: 40, priceUsd: 9.99, envKey: "STRIPE_PRICE_PLAN_STARTER" },
  { id: "pro", monthlyCredits: 120, priceUsd: 19.99, envKey: "STRIPE_PRICE_PLAN_PRO", popular: true },
];

/** Original prices (used for "reset" in admin). */
export const DEFAULT_PRICING = {
  packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, priceUsd: p.priceUsd, popular: !!p.popular })),
  plans: PLANS.map((p) => ({ id: p.id, monthlyCredits: p.monthlyCredits, priceUsd: p.priceUsd, popular: !!p.popular })),
};
export type PricingConfig = typeof DEFAULT_PRICING;

/**
 * Applies the admin's prices (Setting "pricing") onto CREDIT_PACKS / PLANS.
 * Call it (await) before reading prices on the server.
 */
export async function loadPricing(): Promise<PricingConfig> {
  let saved: Partial<PricingConfig> = {};
  try {
    const { db } = await import("./db");
    const row = await db.setting.findUnique({ where: { key: "pricing" } });
    if (row?.value) saved = JSON.parse(row.value);
  } catch {
    /* use defaults */
  }
  for (const p of CREDIT_PACKS) {
    const d = DEFAULT_PRICING.packs.find((x) => x.id === p.id)!;
    const s = saved.packs?.find((x) => x.id === p.id);
    p.credits = s?.credits && s.credits > 0 ? Math.round(s.credits) : d.credits;
    p.priceUsd = s?.priceUsd && s.priceUsd >= 0.5 ? Math.round(s.priceUsd * 100) / 100 : d.priceUsd;
    p.popular = s ? !!s.popular : d.popular;
  }
  for (const p of PLANS) {
    const d = DEFAULT_PRICING.plans.find((x) => x.id === p.id)!;
    const s = saved.plans?.find((x) => x.id === p.id);
    p.monthlyCredits = s?.monthlyCredits && s.monthlyCredits > 0 ? Math.round(s.monthlyCredits) : d.monthlyCredits;
    p.priceUsd = s?.priceUsd && s.priceUsd >= 0.5 ? Math.round(s.priceUsd * 100) / 100 : d.priceUsd;
    p.popular = s ? !!s.popular : d.popular;
  }
  return {
    packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, priceUsd: p.priceUsd, popular: !!p.popular })),
    plans: PLANS.map((p) => ({ id: p.id, monthlyCredits: p.monthlyCredits, priceUsd: p.priceUsd, popular: !!p.popular })),
  };
}

export const priceId = (envKey: string) => process.env[envKey] ?? "";

export function findPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id);
}
export function findPlan(id: string) {
  return PLANS.find((p) => p.id === id);
}
/** Stable Stripe lookup key; includes the amount so a price change makes a new Stripe price. */
export const lookupKey = (kind: "pack" | "plan", id: string, priceUsd: number) =>
  `bf_${kind}_${id}_${Math.round(priceUsd * 100)}`;

/** Finds our plan from a Stripe price (by lookup key, or by an env-configured price id). */
export function planFromPrice(price: { id?: string; lookup_key?: string | null } | null | undefined) {
  if (!price) return undefined;
  const m = price.lookup_key?.match(/^bf_plan_([a-z]+)_\d+$/);
  if (m) return findPlan(m[1]);
  return PLANS.find((p) => priceId(p.envKey) && priceId(p.envKey) === price.id);
}
