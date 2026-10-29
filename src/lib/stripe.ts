import Stripe from "stripe";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { lookupKey, priceId, type CreditPack, type Plan } from "./pricing";

let _stripe: Stripe | null = null;
export function stripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export const appUrl = () =>
  (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

const priceCache = new Map<string, string>();
const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

/**
 * Returns the Stripe price for a pack or plan, creating the product and price
 * in your Stripe account the first time. No manual Stripe setup needed.
 */
export async function getStripePriceId(kind: "pack", item: CreditPack): Promise<string>;
export async function getStripePriceId(kind: "plan", item: Plan): Promise<string>;
export async function getStripePriceId(kind: "pack" | "plan", item: CreditPack | Plan): Promise<string> {
  const override = priceId(item.envKey);
  if (override) return override;

  const key = lookupKey(kind, item.id, item.priceUsd);
  const cached = priceCache.get(key);
  if (cached) return cached;

  const found = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  let id = found.data[0]?.id;
  if (!id) {
    const credits = "credits" in item ? item.credits : item.monthlyCredits;
    const name =
      kind === "pack"
        ? `${site} — ${credits} credits`
        : `${site} ${item.id[0].toUpperCase()}${item.id.slice(1)} — ${credits} credits/month`;
    const price = await stripe().prices.create({
      currency: "usd",
      unit_amount: Math.round(item.priceUsd * 100),
      lookup_key: key,
      ...(kind === "plan" ? { recurring: { interval: "month" as const } } : {}),
      product_data: { name, metadata: { bf_kind: kind, bf_id: item.id } },
    });
    id = price.id;
  }
  priceCache.set(key, id);
  return id;
}

/** Webhook signing secret: env var, or the one saved by Admin → "Connect Stripe". */
export async function webhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET;
  const row = await db.setting.findUnique({ where: { key: "stripe_webhook_secret" } });
  return row?.value || null;
}

export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

/** Returns the user's Stripe customer id, creating the customer the first time. */
export async function ensureCustomer(user: CurrentUser) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
