// Credit packs (one-time) and subscription plans (monthly).
// Prices shown on the site live here; the Stripe Price IDs come from env vars
// (created for you by `npm run stripe:setup`). Edit both together.

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

export const priceId = (envKey: string) => process.env[envKey] ?? "";

export function findPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id);
}
export function findPlan(id: string) {
  return PLANS.find((p) => p.id === id);
}
export function planByPriceId(price: string) {
  return PLANS.find((p) => priceId(p.envKey) === price);
}
