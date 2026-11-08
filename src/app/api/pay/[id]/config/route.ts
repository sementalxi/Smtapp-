import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { locationId, squareAppId, squareConfigured } from "@/lib/square";
import { paypalReady } from "@/lib/paypal";

/** Public: what the on-page card form needs to charge a payment link (no account needed). */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const link = await db.payLink.findUnique({ where: { id }, select: { amountCents: true, status: true } });
  if (!link || link.status !== "open" || !squareConfigured()) return json({ inline: false });
  const appId = await squareAppId();
  if (!appId) return json({ inline: false });
  const loc = (await db.setting.findUnique({ where: { key: "square_location_id" } }))?.value || (await locationId());
  return json({ inline: true, appId, locationId: loc, sandbox: process.env.SQUARE_ENV?.trim() === "sandbox", amount: (link.amountCents / 100).toFixed(2), paypal: paypalReady() ? process.env.PAYPAL_CLIENT_ID!.trim() : undefined });
});
