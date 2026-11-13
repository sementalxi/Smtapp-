import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { checkoutForLink, cleanPayer } from "@/lib/paylinks";

// Public: anyone with the link can pay it (no account needed). Each tap makes a fresh checkout page.
// An open link (many payers) needs the payer's name, so the payment is listed under it.
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link) return json({ error: "not_found" }, 404);
  if (link.status === "paid") return json({ error: "already_paid" }, 400);
  if (link.status !== "open") return json({ error: "closed" }, 400);
  const payer = cleanPayer(((await req.json().catch(() => ({}))) as { payer?: unknown }).payer);
  if (link.multi && payer.length < 2) return json({ error: "name_required" }, 400);
  try {
    return json({ url: await checkoutForLink(link, link.multi ? payer : "") });
  } catch (e) {
    console.error("pay link checkout failed", e);
    return json({ error: "checkout_failed" }, 502);
  }
});
