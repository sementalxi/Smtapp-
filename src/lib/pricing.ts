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
  active?: boolean;
}

export type AiQuality = "low" | "medium" | "high";

export interface Plan {
  /** Lowercase letters/numbers only (used in Square/Stripe keys) */
  id: string;
  name?: string;
  nameEs?: string;
  /** One feature per line, shown as a checklist on the plan card */
  features?: string;
  featuresEs?: string;
  monthlyCredits: number;
  /** Pro AI image quality for subscribers of this plan */
  quality?: AiQuality;
  priceUsd: number;
  envKey: string;
  popular?: boolean;
  active?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", credits: 10, priceUsd: 4.99, envKey: "STRIPE_PRICE_PACK_SMALL" },
  { id: "medium", credits: 30, priceUsd: 11.99, envKey: "STRIPE_PRICE_PACK_MEDIUM", popular: true },
  { id: "large", credits: 100, priceUsd: 29.99, envKey: "STRIPE_PRICE_PACK_LARGE" },
];

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", nameEs: "Básico", monthlyCredits: 40, priceUsd: 9.99, envKey: "STRIPE_PRICE_PLAN_STARTER", quality: "medium" },
  { id: "pro", name: "Pro", nameEs: "Pro", monthlyCredits: 120, priceUsd: 19.99, envKey: "STRIPE_PRICE_PLAN_PRO", popular: true, quality: "high" },
];

export type PlanConfig = { id: string; name: string; nameEs: string; features: string; featuresEs: string; monthlyCredits: number; priceUsd: number; popular: boolean; active: boolean; quality: AiQuality };
function planOut(p: Plan): PlanConfig {
  return {
    id: p.id,
    name: p.name || p.id[0].toUpperCase() + p.id.slice(1),
    nameEs: p.nameEs || p.name || p.id,
    features: p.features ?? "",
    featuresEs: p.featuresEs ?? "",
    monthlyCredits: p.monthlyCredits,
    priceUsd: p.priceUsd,
    popular: !!p.popular,
    active: p.active !== false,
    quality: (p.quality ?? "high") as AiQuality,
  };
}
const BUILTIN_PLANS: Plan[] = PLANS.map((p) => ({ ...p }));

/** Original prices (used for "reset" in admin). */
export const DEFAULT_PRICING = {
  packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, priceUsd: p.priceUsd, popular: !!p.popular, active: true })),
  plans: PLANS.map((p) => planOut({ ...p, active: true })),
};
export type PricingConfig = { packs: (typeof DEFAULT_PRICING)["packs"]; plans: PlanConfig[] };

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
    p.active = s ? s.active !== false : true;
  }
  // Plans: the admin's list (they can add, rename and remove plans); built-in Starter/Pro by default.
  const list: Plan[] = saved.plans?.length
    ? saved.plans
        .filter((x) => x && /^[a-z0-9]{2,20}$/.test(String(x.id)))
        .map((x) => {
          const b = BUILTIN_PLANS.find((p) => p.id === x.id);
          return {
            id: x.id,
            name: x.name || b?.name,
            nameEs: x.nameEs || b?.nameEs,
            features: x.features ?? "",
            featuresEs: x.featuresEs ?? "",
            monthlyCredits: x.monthlyCredits > 0 ? Math.round(x.monthlyCredits) : b?.monthlyCredits ?? 10,
            priceUsd: x.priceUsd >= 0.5 ? Math.round(x.priceUsd * 100) / 100 : b?.priceUsd ?? 9.99,
            envKey: b?.envKey ?? "",
            popular: !!x.popular,
            active: x.active !== false,
            quality: ["low", "medium", "high"].includes(x.quality) ? x.quality : b?.quality ?? "high",
          } as Plan;
        })
    : BUILTIN_PLANS.map((p) => ({ ...p }));
  PLANS.splice(0, PLANS.length, ...list);
  return {
    packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits: p.credits, priceUsd: p.priceUsd, popular: !!p.popular, active: p.active !== false })),
    plans: PLANS.map(planOut),
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
  const m = price.lookup_key?.match(/^bf_plan_([a-z0-9]+)_\d+$/);
  if (m) return findPlan(m[1]);
  return PLANS.find((p) => p.envKey && priceId(p.envKey) && priceId(p.envKey) === price.id);
}

/** Display name of a plan (by id), in the visitor's language. */
export async function planLabel(id: string | null | undefined, es: boolean) {
  if (!id) return "";
  const p = (await loadPricing()).plans.find((x) => x.id === id);
  return (es ? p?.nameEs || p?.name : p?.name) || id;
}
