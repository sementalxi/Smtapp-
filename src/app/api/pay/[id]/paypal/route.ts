import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { paypalReady, pp } from "@/lib/paypal";
import { cleanPayer, recordPaid } from "@/lib/paylinks";

type Capture = { status: string; purchase_units: { custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string }; custom_id?: string }[] } }[] };
const Body = z.union([z.object({ step: z.literal("order"), payer: z.string().max(200).optional() }), z.object({ step: z.literal("capture"), orderId: z.string().min(5).max(60), payer: z.string().max(200).optional() })]);

/** Public: pay a payment link with PayPal on the KIXO page — step "order" makes the PayPal order, "capture" takes the money. */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  rateLimit(req, "paylink_paypal", 20, 60 * 60_000);
  if (!paypalReady()) return json({ error: "paypal_off" }, 400);
  const b = Body.parse(await req.json());
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link) return json({ error: "not_found" }, 404);
  if (link.status === "paid") return json({ error: "already_paid" }, 400);
  if (link.status !== "open") return json({ error: "closed" }, 400);
  // An open link (many payers): the payment is listed under the name the payer typed.
  const payer = link.multi ? cleanPayer(b.payer) : "";
  if (link.multi && payer.length < 2) return json({ error: "name_required" }, 400);

  if (b.step === "order") {
    try {
      const order = await pp<{ id: string }>("/v2/checkout/orders", {
        intent: "CAPTURE",
        purchase_units: [{ reference_id: `paylink_${link.id}`, custom_id: `paylink|${link.id}`, description: `KIXO — ${link.title}${payer ? ` (${payer})` : ""}`.slice(0, 127), amount: { currency_code: "USD", value: (link.amountCents / 100).toFixed(2) } }],
        application_context: { brand_name: "KIXO", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
      });
      return json({ id: order.id });
    } catch (e) {
      console.error("[paypal] pay link order failed", e);
      return json({ error: "paypal_error", detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
    }
  }

  let d: Capture;
  try {
    d = await pp<Capture>(`/v2/checkout/orders/${encodeURIComponent(b.orderId)}/capture`, {});
  } catch (e) {
    if (!String(e).includes("ORDER_ALREADY_CAPTURED")) return json({ error: "pay_failed", detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
    d = await pp<Capture>(`/v2/checkout/orders/${encodeURIComponent(b.orderId)}`);
  }
  const unit = d.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  if (!cap || cap.status !== "COMPLETED") return json({ error: "declined", detail: cap?.status ?? d.status }, 402);
  if ((cap.custom_id ?? unit?.custom_id ?? "") !== `paylink|${link.id}`) return json({ error: "forbidden" }, 403);
  // The money is taken from here on: whatever happens next, the payer is told it went through.
  await db.payLink.update({ where: { id: link.id }, data: { provider: "paypal" } }).catch(() => {});
  const receipt = await recordPaid(link, `pp_${cap.id}`, Math.round(Number(cap.amount.value) * 100), { payer, provider: "paypal" });
  return json({ ok: true, credits: 0, ...(receipt ? { receipt } : {}) });
});
