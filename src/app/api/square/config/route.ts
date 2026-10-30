import { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findPack, findPlan, loadPricing } from "@/lib/pricing";
import { locationId, sq, squareAppId, squareConfigured } from "@/lib/square";

/** Registers this site for Apple Pay with Square once per domain (needs the .well-known file we serve). */
async function ensureApplePayDomain(host: string): Promise<string> {
  if (process.env.SQUARE_ENV?.trim() === "sandbox") return "sandbox: Apple Pay needs production";
  if (!host || host.startsWith("localhost")) return "local";
  const key = `applepay_domain_${host}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (row?.value === "ok") return "ok";
  try {
    const r = await sq<{ status?: string }>("/apple-pay/domains", { body: { domain_name: host } });
    const v = r.status === "VERIFIED" || !r.status ? "ok" : `status ${r.status}`;
    await db.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
    return v;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.setting.upsert({ where: { key }, create: { key, value: msg.slice(0, 300) }, update: { value: msg.slice(0, 300) } });
    return msg;
  }
}

/** Public Square IDs + the exact amount the on-page payment popup needs. */
export const GET = handle(async (req: NextRequest) => {
  const user = await apiUser();
  if (!squareConfigured()) return json({ inline: false });
  const appId = await squareAppId();
  if (!appId) return json({ inline: false });
  await loadPricing();
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  let amount = 0;
  if (kind === "pack") amount = findPack(id)?.priceUsd ?? 0;
  else if (kind === "plan") amount = findPlan(id)?.priceUsd ?? 0;
  else if (kind === "deal") amount = (await db.deal.findUnique({ where: { id }, select: { priceUsd: true } }))?.priceUsd ?? 0;
  const [applePay, loc] = await Promise.all([
    ensureApplePayDomain(req.headers.get("x-forwarded-host") ?? req.nextUrl.host),
    db.setting.findUnique({ where: { key: "square_location_id" } }).then((r) => r?.value || locationId()),
  ]);
  return json({ inline: true, ...(user.role === "ADMIN" ? { applePay } : {}), appId, locationId: loc, sandbox: process.env.SQUARE_ENV?.trim() === "sandbox", amount: amount.toFixed(2) });
});
