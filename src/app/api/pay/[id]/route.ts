import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { checkoutForLink } from "@/lib/paylinks";

// Public: anyone with the link can pay it (no account needed). Each tap makes a fresh checkout page.
export const POST = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const link = await db.payLink.findUnique({ where: { id } });
  if (!link) return json({ error: "not_found" }, 404);
  if (link.status === "paid") return json({ error: "already_paid" }, 400);
  if (link.status !== "open") return json({ error: "closed" }, 400);
  try {
    return json({ url: await checkoutForLink(link) });
  } catch (e) {
    console.error("pay link checkout failed", e);
    return json({ error: "checkout_failed" }, 502);
  }
});
