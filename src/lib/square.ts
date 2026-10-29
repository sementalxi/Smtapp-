import crypto from "node:crypto";
import { db } from "./db";
import { appUrl } from "./stripe";
import { PLANS, type Plan } from "./pricing";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";
const VERSION = process.env.SQUARE_VERSION?.trim() || "2024-12-18";

export const squareConfigured = () => !!process.env.SQUARE_ACCESS_TOKEN?.trim();
const sandbox = () => process.env.SQUARE_ENV?.trim() === "sandbox";
const base = () => (sandbox() ? "https://connect.squareupsandbox.com/v2" : "https://connect.squareup.com/v2");

export class SquareError extends Error {}

/** Calls the Square API and returns the JSON body (throws with Square's error detail). */
export async function sq<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) throw new SquareError("SQUARE_ACCESS_TOKEN is not set");
  const res = await fetch(base() + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${token}`, "Square-Version": VERSION, "Content-Type": "application/json", Accept: "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { errors?: { code?: string; detail?: string }[] };
  if (!res.ok || data.errors?.length) {
    const e = data.errors?.[0];
    throw new SquareError(`Square ${res.status}: ${e?.code ?? ""} ${e?.detail ?? ""}`.trim());
  }
  return data as T;
}

const key = () => crypto.randomUUID();

async function getSetting(k: string) {
  return (await db.setting.findUnique({ where: { key: k } }))?.value ?? "";
}
async function setSetting(k: string, value: string) {
  await db.setting.upsert({ where: { key: k }, create: { key: k, value }, update: { value } });
}

/** The Square location that takes the payments (env, saved, or the first active one). */
export async function locationId() {
  const env = process.env.SQUARE_LOCATION_ID?.trim();
  if (env) return env;
  const saved = await getSetting("square_location_id");
  if (saved) return saved;
  const { locations = [] } = await sq<{ locations?: { id: string; status?: string }[] }>("/locations");
  const loc = locations.find((l) => l.status === "ACTIVE") ?? locations[0];
  if (!loc) throw new SquareError("No Square location found on this account");
  await setSetting("square_location_id", loc.id);
  return loc.id;
}

/** Square subscription plan variation for one of our plans — created in the Square catalog the first time. */
export async function planVariationId(plan: Plan) {
  const cents = Math.round(plan.priceUsd * 100);
  const k = `square_plan_${plan.id}_${cents}`;
  const saved = await getSetting(k);
  if (saved) return saved;

  const name = `${site} ${plan.id[0].toUpperCase()}${plan.id.slice(1)} — ${plan.monthlyCredits} credits/month`;
  const planRes = await sq<{ catalog_object: { id: string } }>("/catalog/object", {
    body: {
      idempotency_key: key(),
      object: { type: "SUBSCRIPTION_PLAN", id: "#plan", subscription_plan_data: { name } },
    },
  });
  const varRes = await sq<{ catalog_object: { id: string } }>("/catalog/object", {
    body: {
      idempotency_key: key(),
      object: {
        type: "SUBSCRIPTION_PLAN_VARIATION",
        id: "#variation",
        subscription_plan_variation_data: {
          name: `${name} ($${plan.priceUsd.toFixed(2)})`,
          subscription_plan_id: planRes.catalog_object.id,
          phases: [{ cadence: "MONTHLY", ordinal: 0, pricing: { type: "STATIC", price_money: { amount: cents, currency: "USD" } } }],
        },
      },
    },
  });
  await setSetting(k, varRes.catalog_object.id);
  return varRes.catalog_object.id;
}

/** Finds our plan from a Square plan variation id. */
export async function planFromVariation(variationId: string | undefined) {
  if (!variationId) return undefined;
  const rows = await db.setting.findMany({ where: { key: { startsWith: "square_plan_" }, value: variationId } });
  const id = rows[0]?.key.split("_")[2];
  return PLANS.find((p) => p.id === id);
}

/** Creates a Square checkout page and remembers which user/product it is for. Returns its URL. */
export async function createSquareCheckout(opts: {
  user: { id: string; email: string };
  kind: "pack" | "plan";
  productId: string;
  name: string;
  priceUsd: number;
  credits: number;
  plan?: Plan;
}) {
  const body: Record<string, unknown> = {
    idempotency_key: key(),
    quick_pay: {
      name: opts.name,
      price_money: { amount: Math.round(opts.priceUsd * 100), currency: "USD" },
      location_id: await locationId(),
    },
    checkout_options: {
      redirect_url: `${appUrl()}/billing?success=1`,
      ask_for_shipping_address: false,
      ...(opts.plan ? { subscription_plan_id: await planVariationId(opts.plan) } : {}),
    },
    pre_populated_data: { buyer_email: opts.user.email },
    payment_note: `${site} ${opts.kind} ${opts.productId} — ${opts.user.email}`.slice(0, 500),
  };
  const res = await sq<{ payment_link: { url: string; order_id: string } }>("/online-checkout/payment-links", { body });
  await db.squareCheckout.create({
    data: { orderId: res.payment_link.order_id, userId: opts.user.id, kind: opts.kind, productId: opts.productId, credits: opts.credits },
  });
  return res.payment_link.url;
}

export const SQUARE_EVENTS = ["payment.created", "payment.updated", "subscription.created", "subscription.updated", "invoice.payment_made"];

/** Registers our webhook with Square and saves its signature key (Admin → Connect Square). */
export async function connectSquareWebhook() {
  await locationId();
  for (const p of PLANS) await planVariationId(p);
  const url = `${appUrl()}/api/square/webhook`;
  const res = await sq<{ subscription: { id: string; signature_key?: string } }>("/webhooks/subscriptions", {
    body: {
      idempotency_key: key(),
      subscription: { name: `${site} credits`, event_types: SQUARE_EVENTS, notification_url: url, api_version: VERSION },
    },
  });
  if (!res.subscription.signature_key) throw new SquareError("Square did not return a signature key");
  await setSetting("square_webhook_key", res.subscription.signature_key);
  await setSetting("square_webhook_url", url);
  await setSetting("square_webhook_id", res.subscription.id);
  return url;
}

export async function squareWebhookConfig() {
  const envKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  return {
    key: envKey || (await getSetting("square_webhook_key")),
    url: (envKey && process.env.SQUARE_WEBHOOK_URL?.trim()) || (await getSetting("square_webhook_url")) || `${appUrl()}/api/square/webhook`,
  };
}

/** Square signs notification URL + raw body with HMAC-SHA256 (base64). */
export function verifySquareSignature(rawBody: string, signature: string | null, sigKey: string, url: string) {
  if (!signature || !sigKey) return false;
  const expected = crypto.createHmac("sha256", sigKey).update(url + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
