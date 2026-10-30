import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { grantOnce } from "@/lib/credits";
import { rewardReferrer } from "@/lib/referral";
import { findPack, findPlan, loadPricing } from "@/lib/pricing";
import { locationId, planVariationId, sq, SquareError } from "@/lib/square";
import { rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;
const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";
const Body = z.object({ kind: z.enum(["pack", "plan", "deal"]), id: z.string().min(1).max(60), sourceId: z.string().min(5).max(500), verificationToken: z.string().max(2000).optional() });

/** Charges a card entered in the on-page popup (Square Web Payments). */
export const POST = handle(async (req: NextRequest) => {
  await loadPricing();
  const user = await apiUser();
  rateLimit(req, "square_pay", 15, 60 * 60_000, user.id);
  const b = Body.parse(await req.json());
  const loc = await locationId();

  try {
    // ---- one-time: credit pack or deal ----
    if (b.kind !== "plan") {
      let name = "", price = 0, credits = 0, productId = "";
      if (b.kind === "pack") {
        const p = findPack(b.id);
        if (!p || p.active === false) throw new HttpError(400, "unavailable");
        name = `${site} — ${p.credits} credits`; price = p.priceUsd; credits = p.credits; productId = p.id;
      } else {
        const d = await db.deal.findUnique({ where: { id: b.id } });
        if (!d || !d.active || (d.endsAt && d.endsAt < new Date()) || !d.priceUsd || d.credits <= 0) throw new HttpError(400, "deal_unavailable");
        name = `${site} — ${d.title}`; price = d.priceUsd; credits = d.credits; productId = `deal_${d.id}`;
      }
      const { payment } = await sq<{ payment: { id: string; status: string } }>("/payments", {
        body: {
          idempotency_key: crypto.randomUUID(),
          source_id: b.sourceId,
          ...(b.verificationToken ? { verification_token: b.verificationToken } : {}),
          amount_money: { amount: Math.round(price * 100), currency: "USD" },
          location_id: loc,
          buyer_email_address: user.email,
          reference_id: user.id.slice(0, 40),
          note: `${name} — ${user.email}`.slice(0, 500),
          autocomplete: true,
        },
      });
      if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") return json({ error: "declined", detail: payment.status }, 402);
      const granted = await grantOnce({ userId: user.id, amount: credits, type: "PURCHASE", note: `${b.kind === "pack" ? "Credit pack" : "Deal"}: ${productId}`, externalRef: `sq_pay_${payment.id}` });
      if (granted) {
        await db.payment.upsert({
          where: { stripeRef: `sq_${payment.id}` },
          create: { userId: user.id, stripeRef: `sq_${payment.id}`, kind: "pack", productId, amountCents: Math.round(price * 100), currency: "usd", credits },
          update: {},
        });
        await rewardReferrer(user.id);
      }
      return json({ ok: true, credits });
    }

    // ---- monthly plan: save card → subscription ----
    const plan = findPlan(b.id);
    if (!plan || plan.active === false) throw new HttpError(400, "unavailable");
    if (user.subscriptionId && ["active", "canceling", "pending"].includes(user.subscriptionStatus ?? "")) throw new HttpError(400, "already_subscribed");

    let customerId = user.stripeCustomerId?.startsWith("sq_") ? user.stripeCustomerId.slice(3) : "";
    if (!customerId) {
      const { customer } = await sq<{ customer: { id: string } }>("/customers", {
        body: { idempotency_key: crypto.randomUUID(), email_address: user.email, given_name: user.name.slice(0, 60), reference_id: user.id },
      });
      customerId = customer.id;
      await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: `sq_${customerId}` } });
    }
    const { card } = await sq<{ card: { id: string } }>("/cards", {
      body: { idempotency_key: crypto.randomUUID(), source_id: b.sourceId, ...(b.verificationToken ? { verification_token: b.verificationToken } : {}), card: { customer_id: customerId, reference_id: user.id } },
    });
    const { subscription } = await sq<{ subscription: { id: string; status?: string; charged_through_date?: string } }>("/subscriptions", {
      body: { idempotency_key: crypto.randomUUID(), location_id: loc, plan_variation_id: await planVariationId(plan), customer_id: customerId, card_id: card.id },
    });
    await db.user.update({
      where: { id: user.id },
      data: { subscriptionId: subscription.id, subscriptionStatus: "active", planId: plan.id },
    });
    // Credits are added when Square confirms the first charge (invoice webhook, usually seconds).
    return json({ ok: true, credits: plan.monthlyCredits, plan: plan.id, pending: true });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    const msg = e instanceof SquareError ? e.message : String(e);
    console.error("square pay failed", msg);
    const declined = /CARD_DECLINED|INSUFFICIENT_FUNDS|CVV|EXPIRATION|INVALID_CARD|GENERIC_DECLINE|VERIFY/i.test(msg);
    return json({ error: declined ? "declined" : "pay_failed", detail: msg.replace(/^Square \d+:\s*/, "").slice(0, 200) }, declined ? 402 : 502);
  }
});
