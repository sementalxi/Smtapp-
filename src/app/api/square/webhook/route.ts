import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grantOnce } from "@/lib/credits";
import { findPack, findPlan, loadPricing } from "@/lib/pricing";
import { planFromVariation, sq, squareWebhookConfig, verifySquareSignature } from "@/lib/square";

// Square sends payment / subscription / invoice events here (registered by Admin → Connect Square).

type Money = { amount?: number; currency?: string };
type SqPayment = { id: string; status?: string; order_id?: string; amount_money?: Money; total_money?: Money; buyer_email_address?: string };
type SqSubscription = { id: string; status?: string; customer_id?: string; plan_variation_id?: string; charged_through_date?: string; canceled_date?: string };
type SqInvoice = { id: string; subscription_id?: string; primary_recipient?: { customer_id?: string } };

export async function POST(req: NextRequest) {
  await loadPricing();
  const raw = await req.text();
  const { key, url } = await squareWebhookConfig();
  if (!verifySquareSignature(raw, req.headers.get("x-square-hmacsha256-signature"), key, url)) {
    return new NextResponse("Bad signature", { status: 401 });
  }
  const event = JSON.parse(raw) as { type?: string; data?: { object?: Record<string, unknown> } };
  const obj = event.data?.object ?? {};
  try {
    switch (event.type) {
      case "payment.created":
      case "payment.updated":
        await onPayment(obj.payment as SqPayment);
        break;
      case "subscription.created":
      case "subscription.updated":
        await onSubscription(obj.subscription as SqSubscription);
        break;
      case "invoice.payment_made":
        await onInvoicePaid(obj.invoice as SqInvoice);
        break;
    }
  } catch (err) {
    console.error(`Square webhook ${event.type} failed`, err);
    return new NextResponse("Handler error", { status: 500 }); // Square retries; grants are idempotent
  }
  return NextResponse.json({ received: true });
}

/** One grant per user per calendar month for plans, so a first payment + first invoice never double-count. */
const monthKey = () => new Date().toISOString().slice(0, 7);

async function grantPlanMonth(userId: string, planId: string, amountCents: number, ref: string) {
  const plan = findPlan(planId);
  if (!plan) return;
  const granted = await grantOnce({
    userId,
    amount: plan.monthlyCredits,
    type: "SUBSCRIPTION",
    note: `Monthly credits: ${plan.id}`,
    externalRef: `sq_plan_${userId}_${monthKey()}`,
  });
  if (granted) {
    await db.payment.upsert({
      where: { stripeRef: ref },
      create: { userId, stripeRef: ref, kind: "subscription", productId: plan.id, amountCents, currency: "usd", credits: plan.monthlyCredits },
      update: {},
    });
  }
}

async function onPayment(p: SqPayment | undefined) {
  if (!p?.order_id || p.status !== "COMPLETED") return;
  const co = await db.squareCheckout.findUnique({ where: { orderId: p.order_id } });
  if (!co) return; // not one of our checkout links
  const amountCents = p.total_money?.amount ?? p.amount_money?.amount ?? 0;

  if (co.kind === "pack") {
    const pack = findPack(co.productId);
    const credits = pack?.credits ?? co.credits;
    const granted = await grantOnce({
      userId: co.userId,
      amount: credits,
      type: "PURCHASE",
      note: `${pack ? "Credit pack" : "Deal"}: ${co.productId}`,
      externalRef: `sq_pay_${p.id}`,
    });
    if (granted) {
      await db.payment.upsert({
        where: { stripeRef: `sq_${p.id}` },
        create: { userId: co.userId, stripeRef: `sq_${p.id}`, kind: "pack", productId: co.productId, amountCents, currency: "usd", credits },
        update: {},
      });
    }
    return;
  }

  // First payment of a monthly plan: credits now; the subscription id arrives with subscription.created.
  await db.user.update({ where: { id: co.userId }, data: { planId: co.productId, subscriptionStatus: "active" } });
  await grantPlanMonth(co.userId, co.productId, amountCents, `sq_${p.id}`);
}

/** Square subscriptions are linked to our users by the customer's email. */
async function userForCustomer(customerId: string | undefined) {
  if (!customerId) return null;
  const byId = await db.user.findFirst({ where: { stripeCustomerId: `sq_${customerId}` }, select: { id: true } });
  if (byId) return byId.id;
  const { customer } = await sq<{ customer?: { email_address?: string } }>(`/customers/${customerId}`);
  const email = customer?.email_address?.trim().toLowerCase();
  if (!email) return null;
  const u = await db.user.findUnique({ where: { email }, select: { id: true } });
  return u?.id ?? null;
}

async function onSubscription(s: SqSubscription | undefined) {
  if (!s?.id) return;
  const plan = await planFromVariation(s.plan_variation_id);
  let userId = (await db.user.findFirst({ where: { subscriptionId: s.id }, select: { id: true } }))?.id ?? (await userForCustomer(s.customer_id));
  if (!userId && plan) {
    // Buyer typed a different email on Square's page: match the latest unlinked checkout for this plan.
    const recent = await db.squareCheckout.findMany({
      where: { kind: "plan", productId: plan.id, createdAt: { gte: new Date(Date.now() - 3 * 3600_000) } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    for (const c of recent) {
      const u = await db.user.findUnique({ where: { id: c.userId }, select: { id: true, subscriptionId: true } });
      if (u && !u.subscriptionId) {
        userId = u.id;
        break;
      }
    }
  }
  if (!userId) return;
  const ended = s.status === "CANCELED" || s.status === "DEACTIVATED";
  const status = ended ? "canceled" : s.canceled_date ? "canceling" : s.status === "ACTIVE" ? "active" : (s.status ?? "").toLowerCase();
  await db.user.update({
    where: { id: userId },
    data: ended
      ? { subscriptionId: null, subscriptionStatus: "canceled", planId: null, currentPeriodEnd: null }
      : {
          subscriptionId: s.id,
          subscriptionStatus: status,
          planId: plan?.id ?? undefined,
          currentPeriodEnd: s.charged_through_date ? new Date(`${s.charged_through_date}T00:00:00Z`) : null,
          ...(s.customer_id ? { stripeCustomerId: `sq_${s.customer_id}` } : {}),
        },
  });
}

/** Renewals: every paid subscription invoice gives that month's credits. */
async function onInvoicePaid(inv: SqInvoice | undefined) {
  if (!inv?.subscription_id) return;
  const { subscription } = await sq<{ subscription?: SqSubscription }>(`/subscriptions/${inv.subscription_id}`);
  if (!subscription) return;
  await onSubscription(subscription);
  const user = await db.user.findFirst({ where: { subscriptionId: subscription.id }, select: { id: true } });
  const plan = await planFromVariation(subscription.plan_variation_id);
  if (!user || !plan) return;
  await grantPlanMonth(user.id, plan.id, Math.round(plan.priceUsd * 100), `sq_inv_${inv.id}`);
}
