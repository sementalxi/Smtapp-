// Payment links (Admin → Payment links): one price, one page (kixo.pro/pay/<id>).
//  - One payment (default): a custom order for one person — the link closes once it is paid.
//  - Open for everyone (`multi`): entry fees, tournaments… the link stays open, many people pay it, and every
//    payment is listed with the name the payer typed (PayLinkPayment). The payer gets a receipt page (?p=<id>).
// Works with whichever provider is set up (Square wins, like the rest of the site). The status is kept by the
// webhooks and also checked with the provider when the page opens, so it shows "Paid" even if a webhook is late.
import crypto from "node:crypto";
import { db } from "./db";
import { paymentProvider } from "./payments";
import { appUrl, stripe } from "./stripe";
import { locationId, sq } from "./square";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

/** Short, hard-to-guess link id (e.g. "k7f3x9q2ma"). */
export function newPayLinkId(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(10), (b) => abc[b % abc.length]).join("");
}

export const payUrl = (id: string) => `${appUrl()}/pay/${id}`;
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** The name a payer typed on an open link, tidied up (one line, 60 characters at most). */
export const cleanPayer = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/**
 * A fresh checkout page for this link; returns the provider's URL. On an open link the checkout is remembered as
 * a pending payment with the payer's name, so the payment is listed under that name once the provider confirms it.
 */
export async function checkoutForLink(link: { id: string; title: string; amountCents: number; multi?: boolean }, payer = ""): Promise<string> {
  const provider = paymentProvider();
  if (!provider) throw new Error("No payment provider is set up (Square or Stripe).");
  const name = `${site} — ${link.title}`.slice(0, 250);
  // the payer's receipt id on an open link (the page shows that payment when they come back)
  const receipt = link.multi ? newPayLinkId() + newPayLinkId() : "";
  const back = receipt ? `${payUrl(link.id)}?p=${receipt}` : `${payUrl(link.id)}?done=1`;
  const via: string = provider;
  const pending = (ref: string) =>
    receipt ? db.payLinkPayment.create({ data: { id: receipt, linkId: link.id, ref, status: "pending", amountCents: link.amountCents, payer, provider: via } }) : null;
  if (provider === "square") {
    const res = await sq<{ payment_link: { url: string; order_id: string } }>("/online-checkout/payment-links", {
      body: {
        idempotency_key: crypto.randomUUID(),
        quick_pay: { name, price_money: { amount: link.amountCents, currency: "USD" }, location_id: await locationId() },
        checkout_options: { redirect_url: back, ask_for_shipping_address: false },
        payment_note: `${site} custom order ${link.id}${payer ? ` · ${payer}` : ""}`.slice(0, 500),
      },
    });
    // the Square webhook finds custom orders through this row
    await db.squareCheckout.create({ data: { orderId: res.payment_link.order_id, userId: "", kind: "custom", productId: link.id, credits: 0 } });
    await db.payLink.update({ where: { id: link.id }, data: { provider, providerRef: res.payment_link.order_id } });
    await pending(`sqo_${res.payment_link.order_id}`);
    return res.payment_link.url;
  }
  const metadata: Record<string, string> = { kind: "custom", payLinkId: link.id };
  if (payer) metadata.payer = payer;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", unit_amount: link.amountCents, product_data: { name } }, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
    success_url: back,
    cancel_url: payUrl(link.id),
  });
  await db.payLink.update({ where: { id: link.id }, data: { provider, providerRef: session.id } });
  await pending(`st_${session.id}`);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

type PaidExtra = {
  /** The name the payer typed (open links). */
  payer?: string;
  provider?: string;
  /**
   * Open links paid on the provider's own checkout page: the id that checkout is remembered under
   * ("sqo_<order id>") — the webhook and the "check with the provider" path both name the same checkout this
   * way, so one payment is never counted twice.
   */
  checkoutRef?: string;
};

/**
 * Records a payment of a link and tells the live log.
 *  - One-payment link: marks it paid (once).
 *  - Open link: adds the payment to its list (once per payment); the link stays open. Returns the receipt id.
 */
export async function markPayLinkPaid(id: string, ref: string, amountCents?: number, extra: PaidExtra = {}): Promise<string | null> {
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link) return null;
  const log = (text: string) =>
    import("./activity")
      .then((m) => m.logActivity("site", "payment", text))
      .catch(() => {});
  if (link.multi) {
    const key = extra.checkoutRef ?? ref;
    const amount = amountCents ?? link.amountCents;
    const provider = extra.provider || link.provider || "";
    const payer = cleanPayer(extra.payer);
    // Already on the list? Under the checkout's id — or, for a link switched to "open" after it was paid, under
    // the payment's own id.
    const found = (await db.payLinkPayment.findUnique({ where: { ref: key } })) ?? (key !== ref ? await db.payLinkPayment.findUnique({ where: { ref } }) : null);
    if (found && found.status !== "pending") return found.id; // already counted — or taken off the list by an admin ("removed")
    let receipt: string;
    let who = payer;
    if (found) {
      // a checkout page that was waiting: paid now (only one of two racing calls gets to flip it)
      const flipped = await db.payLinkPayment.updateMany({ where: { ref: found.ref, status: "pending" }, data: { status: "paid", paidAt: new Date(), amountCents: amount, ...(payer ? { payer } : {}), ...(provider ? { provider } : {}) } });
      if (!flipped.count) return found.id;
      receipt = found.id;
      who = payer || found.payer;
    } else {
      const made = await db.payLinkPayment.create({ data: { linkId: id, ref: key, status: "paid", paidAt: new Date(), amountCents: amount, payer, provider } }).catch((e: unknown) => {
        if ((e as { code?: string } | null)?.code === "P2002") return null; // the same payment arrived twice at the same moment
        throw e;
      });
      // null: the other call recorded it
      if (!made) return (await db.payLinkPayment.findUnique({ where: { ref: key } }))?.id ?? null;
      receipt = made.id;
    }
    await db.payLink.update({ where: { id }, data: { paidAt: new Date(), paidRef: ref } });
    const count = await db.payLinkPayment.count({ where: { linkId: id, status: "paid" } });
    await log(`💳 Payment #${count} ${money(amount)} · ${link.title}${who ? ` · ${who}` : ""} (${provider || "checkout"})`);
    return receipt;
  }
  if (link.status === "paid") return null;
  await db.payLink.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paidRef: ref } });
  await log(`💳 Custom order paid ${money(amountCents ?? link.amountCents)} · ${link.title}${link.customer ? ` · ${link.customer}` : ""} (${link.provider || "checkout"})`);
  return null;
}

/**
 * For the moment right after the provider took the money: records the payment, and if that fails the payer is
 * still told it went through (it did) while the live log asks the admin to list it by hand.
 */
export async function recordPaid(link: { id: string; title: string }, ref: string, amountCents: number | undefined, extra: PaidExtra = {}): Promise<string | null> {
  try {
    return await markPayLinkPaid(link.id, ref, amountCents, extra);
  } catch (e) {
    console.error("payment taken but not recorded", link.id, ref, e);
    await import("./activity")
      .then((m) => m.logActivity("site", "payment", `⚠️ PAID but not recorded — ${link.title}${extra.payer ? ` · ${extra.payer}` : ""}${amountCents ? ` · ${money(amountCents)}` : ""} · ${ref}. Add it by hand in Admin → Payment links.`, "error"))
      .catch(() => {});
    return null;
  }
}

/** Asks the provider whether one of its checkout pages was paid ("square": order id, "stripe": session id). */
async function checkoutPaid(provider: string, providerRef: string): Promise<{ ref: string; amountCents?: number } | null> {
  if (provider === "square") {
    const { order } = await sq<{ order?: { state?: string; tenders?: { id: string }[]; net_amount_due_money?: { amount?: number }; total_money?: { amount?: number } } }>(`/orders/${providerRef}`);
    const paid = !!order?.tenders?.length && (order.net_amount_due_money?.amount ?? 1) === 0;
    if (paid || order?.state === "COMPLETED") return { ref: `sq_${order?.tenders?.[0]?.id ?? providerRef}`, amountCents: order?.total_money?.amount };
  } else if (provider === "stripe") {
    const s = await stripe().checkout.sessions.retrieve(providerRef);
    if (s.payment_status === "paid") return { ref: `st_${s.id}`, amountCents: s.amount_total ?? undefined };
  }
  return null;
}

/** An open link's checkout page that is still waiting: asks the provider whether it was paid meanwhile. */
export async function refreshPending(p: { linkId: string; ref: string; provider: string; status: string }) {
  if (p.status !== "pending") return;
  try {
    const r = await checkoutPaid(p.provider, p.ref.replace(/^(sqo|st)_/, ""));
    if (r) await markPayLinkPaid(p.linkId, r.ref, r.amountCents, { checkoutRef: p.ref, provider: p.provider });
  } catch (e) {
    console.error("refreshPending failed", e);
  }
}

/** Asks the provider whether the last checkout of an open link was paid (for when the webhook is late or missing). */
export async function refreshPayLink(link: { id: string; status: string; provider: string; providerRef: string; multi?: boolean }) {
  if (link.status !== "open") return;
  if (link.multi) {
    // every checkout page of the last two days that is still waiting (a handful at most)
    const waiting = await db.payLinkPayment.findMany({ where: { linkId: link.id, status: "pending", createdAt: { gt: new Date(Date.now() - 48 * 3600_000) } }, orderBy: { createdAt: "desc" }, take: 8 });
    for (const p of waiting) await refreshPending(p);
    return;
  }
  if (!link.providerRef) return;
  try {
    const r = await checkoutPaid(link.provider, link.providerRef);
    if (r) await markPayLinkPaid(link.id, r.ref, r.amountCents);
  } catch (e) {
    console.error("refreshPayLink failed", e);
  }
}

export type PayLinkPaymentRow = { id: string; payer: string; amountCents: number; provider: string; at: string };

/** The paid payments of some links, oldest first, grouped by link (for the admin list). */
export async function paymentsOfLinks(ids: string[]): Promise<Record<string, PayLinkPaymentRow[]>> {
  const out: Record<string, PayLinkPaymentRow[]> = {};
  if (!ids.length) return out;
  const rows = await db.payLinkPayment.findMany({ where: { linkId: { in: ids }, status: "paid" }, orderBy: { createdAt: "asc" } });
  for (const r of rows) (out[r.linkId] ??= []).push({ id: r.id, payer: r.payer, amountCents: r.amountCents, provider: r.provider, at: (r.paidAt ?? r.createdAt).toISOString() });
  return out;
}
