// Custom order payment links (Admin → Payment links): one price, one page (kixo.pro/pay/<id>), paid once.
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

/** A fresh checkout page for this link; returns the provider's URL. */
export async function checkoutForLink(link: { id: string; title: string; amountCents: number }): Promise<string> {
  const provider = paymentProvider();
  if (!provider) throw new Error("No payment provider is set up (Square or Stripe).");
  const name = `${site} — ${link.title}`.slice(0, 250);
  const back = `${payUrl(link.id)}?done=1`;
  if (provider === "square") {
    const res = await sq<{ payment_link: { url: string; order_id: string } }>("/online-checkout/payment-links", {
      body: {
        idempotency_key: crypto.randomUUID(),
        quick_pay: { name, price_money: { amount: link.amountCents, currency: "USD" }, location_id: await locationId() },
        checkout_options: { redirect_url: back, ask_for_shipping_address: false },
        payment_note: `${site} custom order ${link.id}`,
      },
    });
    // the Square webhook finds custom orders through this row
    await db.squareCheckout.create({ data: { orderId: res.payment_link.order_id, userId: "", kind: "custom", productId: link.id, credits: 0 } });
    await db.payLink.update({ where: { id: link.id }, data: { provider, providerRef: res.payment_link.order_id } });
    return res.payment_link.url;
  }
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", unit_amount: link.amountCents, product_data: { name } }, quantity: 1 }],
    metadata: { kind: "custom", payLinkId: link.id },
    payment_intent_data: { metadata: { kind: "custom", payLinkId: link.id } },
    success_url: back,
    cancel_url: payUrl(link.id),
  });
  await db.payLink.update({ where: { id: link.id }, data: { provider, providerRef: session.id } });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Marks a link paid (once) and tells the live log. */
export async function markPayLinkPaid(id: string, ref: string, amountCents?: number) {
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link || link.status === "paid") return;
  await db.payLink.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paidRef: ref } });
  await import("./activity")
    .then((m) => m.logActivity("site", "payment", `💳 Custom order paid ${money(amountCents ?? link.amountCents)} · ${link.title}${link.customer ? ` · ${link.customer}` : ""} (${link.provider || "checkout"})`))
    .catch(() => {});
}

/** Asks the provider whether the last checkout of an open link was paid (for when the webhook is late or missing). */
export async function refreshPayLink(link: { id: string; status: string; provider: string; providerRef: string }) {
  if (link.status !== "open" || !link.providerRef) return;
  try {
    if (link.provider === "square") {
      const { order } = await sq<{ order?: { state?: string; tenders?: { id: string }[]; net_amount_due_money?: { amount?: number }; total_money?: { amount?: number } } }>(`/orders/${link.providerRef}`);
      const paid = !!order?.tenders?.length && (order.net_amount_due_money?.amount ?? 1) === 0;
      if (paid || order?.state === "COMPLETED") await markPayLinkPaid(link.id, `sq_${order?.tenders?.[0]?.id ?? link.providerRef}`, order?.total_money?.amount);
    } else if (link.provider === "stripe") {
      const s = await stripe().checkout.sessions.retrieve(link.providerRef);
      if (s.payment_status === "paid") await markPayLinkPaid(link.id, `st_${s.id}`, s.amount_total ?? undefined);
    }
  } catch (e) {
    console.error("refreshPayLink failed", e);
  }
}
