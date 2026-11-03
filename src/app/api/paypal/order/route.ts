import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { paypalReady, pp } from "@/lib/paypal";
import { oneTimeItem } from "@/lib/purchasable";

/** Creates a PayPal order for a credit pack or deal. */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  if (!paypalReady()) throw new HttpError(400, "paypal_off");
  const b = z.object({ kind: z.enum(["pack", "deal"]), id: z.string().min(1).max(60) }).parse(await req.json());
  const item = await oneTimeItem(b.kind, b.id);
  let order: { id: string };
  try {
  order = await pp<{ id: string }>("/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: item.productId,
        custom_id: `${user.id}|${item.productId}|${item.credits}`,
        description: item.name,
        amount: { currency_code: "USD", value: item.priceUsd.toFixed(2) },
      },
    ],
    application_context: { brand_name: "KIXO", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    console.error("[paypal] order failed", msg);
    // Most common: keys from Sandbox used in Live mode (or the other way round).
    const detail = /auth failed/i.test(msg)
      ? "PayPal keys rejected — Sandbox keys need PAYPAL_ENV=sandbox on Vercel; Live keys must NOT have PAYPAL_ENV. Check Client ID/Secret have no spaces, then redeploy."
      : msg;
    return json({ error: "paypal_error", detail }, 502);
  }
  return json({ id: order.id });
});
