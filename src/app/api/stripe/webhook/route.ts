import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { grantOnce } from "@/lib/credits";
import { findPack, planByPriceId } from "@/lib/pricing";

// Stripe sends events here. Configure the endpoint in the Stripe dashboard with:
//   checkout.session.completed, invoice.paid,
//   customer.subscription.updated, customer.subscription.deleted

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (err) {
    console.error("Webhook signature failed", err);
    return new NextResponse("Bad signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChange(event.data.object as Stripe.Subscription, event.type === "customer.subscription.deleted");
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} failed`, err);
    // 500 makes Stripe retry later; grants are idempotent so retries are safe.
    return new NextResponse("Handler error", { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function userIdFor(customerId: string | null | undefined, metaUserId?: string | null) {
  if (metaUserId) return metaUserId;
  if (!customerId) return null;
  const u = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  return u?.id ?? null;
}

const idOf = (v: unknown): string | null =>
  typeof v === "string" ? v : v && typeof v === "object" && "id" in v ? String((v as { id: string }).id) : null;

async function onCheckoutCompleted(s: Stripe.Checkout.Session) {
  const userId = await userIdFor(idOf(s.customer), s.metadata?.userId);
  if (!userId) return;

  if (s.mode === "payment" && s.payment_status === "paid" && s.metadata?.kind === "pack") {
    const pack = findPack(s.metadata.productId ?? "");
    const credits = pack?.credits ?? Number(s.metadata.credits ?? 0);
    if (!credits) return;
    const granted = await grantOnce({
      userId,
      amount: credits,
      type: "PURCHASE",
      note: `Credit pack: ${pack?.id ?? s.metadata.productId}`,
      externalRef: `cs_${s.id}`,
    });
    if (granted) {
      await db.payment.upsert({
        where: { stripeRef: s.id },
        create: {
          userId,
          stripeRef: s.id,
          kind: "pack",
          productId: pack?.id ?? "",
          amountCents: s.amount_total ?? 0,
          currency: s.currency ?? "usd",
          credits,
        },
        update: {},
      });
    }
  }

  if (s.mode === "subscription") {
    const subId = idOf(s.subscription);
    if (!subId) return;
    const sub = await stripe().subscriptions.retrieve(subId);
    await syncSubscription(userId, sub);
  }
}

/** Monthly credits are granted on every paid subscription invoice (including the first). */
async function onInvoicePaid(inv: Stripe.Invoice) {
  // The subscription id moved in newer Stripe API versions; support both shapes.
  const raw = inv as unknown as {
    subscription?: unknown;
    parent?: { subscription_details?: { subscription?: unknown } };
  };
  const subId = idOf(raw.subscription) ?? idOf(raw.parent?.subscription_details?.subscription);
  if (!subId) return; // one-off invoice, not a subscription

  const sub = await stripe().subscriptions.retrieve(subId);
  const userId = await userIdFor(idOf(sub.customer), sub.metadata?.userId);
  if (!userId) return;

  const price = sub.items.data[0]?.price?.id ?? "";
  const plan = planByPriceId(price);
  if (!plan) {
    console.warn("invoice.paid for unknown price", price);
    return;
  }

  const granted = await grantOnce({
    userId,
    amount: plan.monthlyCredits,
    type: "SUBSCRIPTION",
    note: `Monthly credits: ${plan.id}`,
    externalRef: `in_${inv.id}`,
  });
  if (granted) {
    await db.payment.upsert({
      where: { stripeRef: inv.id ?? `in_${Date.now()}` },
      create: {
        userId,
        stripeRef: inv.id ?? `in_${Date.now()}`,
        kind: "subscription",
        productId: plan.id,
        amountCents: inv.amount_paid ?? 0,
        currency: inv.currency ?? "usd",
        credits: plan.monthlyCredits,
      },
      update: {},
    });
  }
  await syncSubscription(userId, sub, inv);
}

async function onSubscriptionChange(sub: Stripe.Subscription, deleted: boolean) {
  const userId = await userIdFor(idOf(sub.customer), sub.metadata?.userId);
  if (!userId) return;
  if (deleted) {
    await db.user.updateMany({
      where: { id: userId, subscriptionId: sub.id },
      data: { subscriptionStatus: "canceled", subscriptionId: null, planId: null, currentPeriodEnd: null },
    });
    return;
  }
  await syncSubscription(userId, sub);
}

async function syncSubscription(userId: string, sub: Stripe.Subscription, inv?: Stripe.Invoice) {
  const plan = planByPriceId(sub.items.data[0]?.price?.id ?? "");
  // current_period_end lives on the subscription (older API) or its items (newer API)
  const rawSub = sub as unknown as { current_period_end?: number };
  const rawItem = sub.items.data[0] as unknown as { current_period_end?: number } | undefined;
  const lineEnd = inv?.lines?.data?.[0]?.period?.end;
  const end = rawSub.current_period_end ?? rawItem?.current_period_end ?? lineEnd;

  await db.user.update({
    where: { id: userId },
    data: {
      subscriptionId: sub.id,
      subscriptionStatus: sub.cancel_at_period_end ? "canceling" : sub.status,
      planId: plan?.id ?? null,
      currentPeriodEnd: end ? new Date(end * 1000) : null,
      stripeCustomerId: idOf(sub.customer) ?? undefined,
    },
  });
}
