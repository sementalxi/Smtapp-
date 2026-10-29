import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { appUrl, ensureCustomer, stripe } from "@/lib/stripe";
import { findPack, findPlan, priceId } from "@/lib/pricing";

const Body = z.object({ kind: z.enum(["pack", "plan"]), id: z.string() });

export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const body = Body.parse(await req.json());
  const customer = await ensureCustomer(user);
  const base = appUrl();

  if (body.kind === "pack") {
    const pack = findPack(body.id);
    if (!pack || !priceId(pack.envKey)) throw new HttpError(400, "unknown_pack");
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [{ price: priceId(pack.envKey), quantity: 1 }],
      metadata: { userId: user.id, kind: "pack", productId: pack.id, credits: String(pack.credits) },
      payment_intent_data: { metadata: { userId: user.id, kind: "pack", productId: pack.id } },
      allow_promotion_codes: true,
      success_url: `${base}/billing?success=1`,
      cancel_url: `${base}/pricing?canceled=1`,
    });
    return json({ url: session.url });
  }

  const plan = findPlan(body.id);
  if (!plan || !priceId(plan.envKey)) throw new HttpError(400, "unknown_plan");

  // Already subscribed → plan changes and cancellations happen in the billing portal.
  if (user.subscriptionId && ["active", "trialing", "past_due", "canceling"].includes(user.subscriptionStatus ?? "")) {
    const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${base}/billing` });
    return json({ url: portal.url });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId(plan.envKey), quantity: 1 }],
    metadata: { userId: user.id, kind: "subscription", productId: plan.id },
    subscription_data: { metadata: { userId: user.id, planId: plan.id } },
    allow_promotion_codes: true,
    success_url: `${base}/billing?success=1`,
    cancel_url: `${base}/pricing?canceled=1`,
  });
  return json({ url: session.url });
});
