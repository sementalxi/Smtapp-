import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { db } from "@/lib/db";
import { appUrl, ensureCustomer, getStripePriceId, stripe } from "@/lib/stripe";
import { findPack, findPlan, loadPricing } from "@/lib/pricing";
import { paymentProvider } from "@/lib/payments";
import { createSquareCheckout } from "@/lib/square";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

const Body = z.object({ kind: z.enum(["pack", "plan", "deal"]), id: z.string() });

export const POST = handle(async (req: NextRequest) => {
  await loadPricing();
  const user = await apiUser();
  const body = Body.parse(await req.json());

  if (body.kind === "pack" && findPack(body.id)?.active === false) throw new HttpError(400, "unavailable");
  if (body.kind === "plan" && findPlan(body.id)?.active === false) throw new HttpError(400, "unavailable");

  // A deal from the home page with a real price + credits.
  let deal: { id: string; title: string; priceUsd: number; credits: number } | null = null;
  if (body.kind === "deal") {
    const d = await db.deal.findUnique({ where: { id: body.id } });
    if (!d || !d.active || (d.endsAt && d.endsAt < new Date()) || !d.priceUsd || d.credits <= 0) throw new HttpError(400, "deal_unavailable");
    deal = { id: d.id, title: d.title, priceUsd: d.priceUsd, credits: d.credits };
  }

  // Square (if set up) takes the payment instead of Stripe.
  if (paymentProvider() === "square") {
    if (deal) {
      try {
        const url = await createSquareCheckout({ user, kind: "pack", productId: `deal_${deal.id}`, name: `${site} — ${deal.title} (${deal.credits} credits)`.slice(0, 250), priceUsd: deal.priceUsd, credits: deal.credits });
        return json({ url });
      } catch (e) {
        console.error("square deal checkout failed", e);
        return json({ error: "checkout_failed", detail: e instanceof Error ? e.message.slice(0, 300) : "unknown" }, 502);
      }
    }
    try {
    if (body.kind === "pack") {
      const pack = findPack(body.id);
      if (!pack) throw new HttpError(400, "unknown_pack");
      const url = await createSquareCheckout({ user, kind: "pack", productId: pack.id, name: `${site} — ${pack.credits} credits`, priceUsd: pack.priceUsd, credits: pack.credits });
      return json({ url });
    }
    const plan = findPlan(body.id);
    if (!plan) throw new HttpError(400, "unknown_plan");
    if (user.subscriptionId && ["active", "canceling", "pending"].includes(user.subscriptionStatus ?? "")) throw new HttpError(400, "already_subscribed");
    const url = await createSquareCheckout({
      user,
      kind: "plan",
      productId: plan.id,
      name: `${site} ${plan.id.toUpperCase()} — ${plan.monthlyCredits} credits/month`,
      priceUsd: plan.priceUsd,
      credits: plan.monthlyCredits,
      plan,
    });
    return json({ url });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error("square checkout failed", e);
      return json({ error: "checkout_failed", detail: e instanceof Error ? e.message.slice(0, 300) : "unknown" }, 502);
    }
  }

  const customer = await ensureCustomer(user);
  const base = appUrl();

  if (deal) {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [{ price_data: { currency: "usd", unit_amount: Math.round(deal.priceUsd * 100), product_data: { name: `${site} — ${deal.title} (${deal.credits} credits)`.slice(0, 250) } }, quantity: 1 }],
      metadata: { userId: user.id, kind: "pack", productId: `deal_${deal.id}`, credits: String(deal.credits) },
      payment_intent_data: { metadata: { userId: user.id, kind: "pack", productId: `deal_${deal.id}` } },
      success_url: `${base}/billing?success=1`,
      cancel_url: `${base}/?canceled=1`,
    });
    return json({ url: session.url });
  }

  if (body.kind === "pack") {
    const pack = findPack(body.id);
    if (!pack) throw new HttpError(400, "unknown_pack");
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [{ price: await getStripePriceId("pack", pack), quantity: 1 }],
      metadata: { userId: user.id, kind: "pack", productId: pack.id, credits: String(pack.credits) },
      payment_intent_data: { metadata: { userId: user.id, kind: "pack", productId: pack.id } },
      allow_promotion_codes: true,
      success_url: `${base}/billing?success=1`,
      cancel_url: `${base}/pricing?canceled=1`,
    });
    return json({ url: session.url });
  }

  const plan = findPlan(body.id);
  if (!plan) throw new HttpError(400, "unknown_plan");

  // Already subscribed → plan changes and cancellations happen in the billing portal.
  if (user.subscriptionId && ["active", "trialing", "past_due", "canceling"].includes(user.subscriptionStatus ?? "")) {
    const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${base}/billing` });
    return json({ url: portal.url });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: await getStripePriceId("plan", plan), quantity: 1 }],
    metadata: { userId: user.id, kind: "subscription", productId: plan.id },
    subscription_data: { metadata: { userId: user.id, planId: plan.id } },
    allow_promotion_codes: true,
    success_url: `${base}/billing?success=1`,
    cancel_url: `${base}/pricing?canceled=1`,
  });
  return json({ url: session.url });
});
