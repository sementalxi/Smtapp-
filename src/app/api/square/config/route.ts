import { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findPack, findPlan, loadPricing } from "@/lib/pricing";
import { locationId, sq, squareConfigured } from "@/lib/square";

/** Registers this site for Apple Pay with Square once per domain (needs the .well-known file we serve). */
async function ensureApplePayDomain(host: string) {
  if (process.env.SQUARE_ENV?.trim() === "sandbox" || !host || host.startsWith("localhost")) return;
  const key = `applepay_domain_${host}`;
  if (await db.setting.findUnique({ where: { key } })) return;
  try {
    await sq("/apple-pay/domains", { body: { domain_name: host } });
    await db.setting.upsert({ where: { key }, create: { key, value: "ok" }, update: { value: "ok" } });
  } catch (e) {
    console.warn("apple pay domain registration failed", e instanceof Error ? e.message : e);
  }
}

/** Public Square IDs + the exact amount the on-page payment popup needs. */
export const GET = handle(async (req: NextRequest) => {
  await apiUser();
  const appId = process.env.SQUARE_APPLICATION_ID?.trim();
  if (!squareConfigured() || !appId) return json({ inline: false });
  await loadPricing();
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let amount = 0;
  if (kind === "pack") amount = findPack(id)?.priceUsd ?? 0;
  else if (kind === "plan") amount = findPlan(id)?.priceUsd ?? 0;
  else if (kind === "deal") amount = (await db.deal.findUnique({ where: { id }, select: { priceUsd: true } }))?.priceUsd ?? 0;
  await ensureApplePayDomain(req.headers.get("x-forwarded-host") ?? req.nextUrl.host);
  return json({ inline: true, appId, locationId: await locationId(), sandbox: process.env.SQUARE_ENV?.trim() === "sandbox", amount: amount.toFixed(2) });
});
