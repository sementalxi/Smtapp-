import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { locationId, sq, SquareError } from "@/lib/square";
import { cleanPayer, recordPaid } from "@/lib/paylinks";

export const maxDuration = 60;
const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";
const Body = z.object({ sourceId: z.string().min(5).max(500), verificationToken: z.string().max(2000).optional(), payer: z.string().max(200).optional() });

/** Public: charges a payment link with the card / Apple Pay / Google Pay entered on the KIXO page (Square). */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  rateLimit(req, "paylink_charge", 12, 60 * 60_000);
  const b = Body.parse(await req.json());
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link) return json({ error: "not_found" }, 404);
  if (link.status === "paid") return json({ error: "already_paid" }, 400);
  if (link.status !== "open") return json({ error: "closed" }, 400);
  // An open link (many payers): the payment is listed under the name the payer typed.
  const payer = link.multi ? cleanPayer(b.payer) : "";
  if (link.multi && payer.length < 2) return json({ error: "name_required" }, 400);
  try {
    const { payment } = await sq<{ payment: { id: string; status: string; total_money?: { amount?: number } } }>("/payments", {
      body: {
        // one charge per card entry even if the button is tapped twice
        idempotency_key: `paylink-${link.id}-${crypto.createHash("sha1").update(b.sourceId).digest("hex").slice(0, 16)}`,
        source_id: b.sourceId,
        ...(b.verificationToken ? { verification_token: b.verificationToken } : {}),
        amount_money: { amount: link.amountCents, currency: "USD" },
        location_id: await locationId(),
        reference_id: link.id,
        note: `${site} ${link.multi ? "payment" : "custom order"} — ${link.title}${payer || link.customer ? ` (${payer || link.customer})` : ""}`.slice(0, 500),
        autocomplete: true,
      },
    });
    if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") return json({ error: "declined", detail: payment.status }, 402);
    // The money is taken from here on: whatever happens next, the payer is told it went through.
    await db.payLink.update({ where: { id: link.id }, data: { provider: "square" } }).catch(() => {});
    // open link: `receipt` is this payer's own receipt page (/pay/<id>?p=<receipt>)
    const receipt = await recordPaid(link, `sq_${payment.id}`, payment.total_money?.amount, { payer, provider: "square" });
    return json({ ok: true, credits: 0, ...(receipt ? { receipt } : {}) });
  } catch (e) {
    const msg = e instanceof SquareError ? e.message : String(e);
    console.error("pay link charge failed", msg);
    const declined = /CARD_DECLINED|INSUFFICIENT_FUNDS|CVV|EXPIRATION|INVALID_CARD|GENERIC_DECLINE|VERIFY/i.test(msg);
    return json({ error: declined ? "declined" : "pay_failed", detail: msg.replace(/^Square \d+:\s*/, "").slice(0, 200) }, declined ? 402 : 502);
  }
});
