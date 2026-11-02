import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { grantOnce } from "@/lib/credits";
import { rewardReferrer } from "@/lib/referral";
import { paypalReady, pp } from "@/lib/paypal";
import { logPayment } from "@/lib/discord-logs";

type Capture = {
  status: string;
  purchase_units: { custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string }; custom_id?: string }[] } }[];
};

/** Captures an approved PayPal order and adds the credits (once). */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  if (!paypalReady()) throw new HttpError(400, "paypal_off");
  const { orderId } = z.object({ orderId: z.string().min(5).max(60) }).parse(await req.json());
  let d: Capture;
  try {
    d = await pp<Capture>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {});
  } catch (e) {
    // Already captured (e.g. double tap) → read it instead.
    if (!String(e).includes("ORDER_ALREADY_CAPTURED")) return json({ error: "pay_failed", detail: String(e instanceof Error ? e.message : e).slice(0, 200) }, 502);
    d = await pp<Capture>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }
  const unit = d.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  if (!cap || cap.status !== "COMPLETED") return json({ error: "declined", detail: cap?.status ?? d.status }, 402);
  const [uid, productId, creditsStr] = (cap.custom_id ?? unit?.custom_id ?? "").split("|");
  if (uid !== user.id) throw new HttpError(403, "forbidden");
  const credits = Number(creditsStr) || 0;
  const granted = await grantOnce({ userId: user.id, amount: credits, type: "PURCHASE", note: `PayPal: ${productId}`, externalRef: `pp_${cap.id}` });
  if (granted) {
    await db.payment.upsert({
      where: { stripeRef: `pp_${cap.id}` },
      create: { userId: user.id, stripeRef: `pp_${cap.id}`, kind: "pack", productId, amountCents: Math.round(Number(cap.amount.value) * 100), currency: "usd", credits },
      update: {},
    });
    await logPayment({ userId: user.id, kind: "pack", productId, amountCents: Math.round(Number(cap.amount.value) * 100), credits, source: "PayPal" });
    await rewardReferrer(user.id);
  }
  return json({ ok: true, credits });
});
