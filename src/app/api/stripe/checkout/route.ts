import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { appUrl, ensureCustomer, getStripePriceId, stripe } from "@/lib/stripe";
import { findPack, findPlan } from "@/lib/pricing";
import { paymentProvider } from "@/lib/payments";
import { createSquareCheckout } from "@/lib/square";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

const Body = z.object({ kind: z.enum(["pack", "plan"]), id: z.string() });

export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const body = Body.parse(await req.json());

  // Square (if set up) takes the payment instead of Stripe.
  if (paymentProvider() === "square") {
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
