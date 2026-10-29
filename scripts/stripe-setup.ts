// Creates the Stripe products/prices for the packs and plans in src/lib/pricing.ts
// and prints the env vars to paste into .env / Vercel.
//
//   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
//
// Safe to re-run: it reuses products it created before (matched by metadata).

import Stripe from "stripe";
import { CREDIT_PACKS, PLANS } from "../src/lib/pricing";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "BannerForge";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Set STRIPE_SECRET_KEY first");
  const stripe = new Stripe(key);

  const existing = await stripe.products.list({ limit: 100, active: true });
  const lines: string[] = [];

  async function ensure(id: string, name: string, cents: number, recurring: boolean, envKey: string) {
    let product = existing.data.find((p) => p.metadata?.bf_id === id);
    if (!product) {
      product = await stripe.products.create({ name, metadata: { bf_id: id } });
      console.log("created product", name);
    }
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
    let price = prices.data.find(
      (p) => p.unit_amount === cents && p.currency === "usd" && (recurring ? p.recurring?.interval === "month" : !p.recurring),
    );
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: cents,
        currency: "usd",
        ...(recurring ? { recurring: { interval: "month" as const } } : {}),
      });
      console.log("created price", name, cents / 100);
    }
    lines.push(`${envKey}="${price.id}"`);
  }

  for (const p of CREDIT_PACKS) {
    await ensure(`pack_${p.id}`, `${site} — ${p.credits} credits`, Math.round(p.priceUsd * 100), false, p.envKey);
  }
  for (const p of PLANS) {
    await ensure(
      `plan_${p.id}`,
      `${site} ${p.id[0].toUpperCase() + p.id.slice(1)} — ${p.monthlyCredits} credits/month`,
      Math.round(p.priceUsd * 100),
      true,
      p.envKey,
    );
  }

  console.log("\nAdd these to your environment:\n");
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
