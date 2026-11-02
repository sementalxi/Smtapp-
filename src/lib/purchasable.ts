import { db } from "./db";
import { HttpError } from "./auth";
import { findPack, loadPricing } from "./pricing";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

/** What a one-time purchase (pack or deal) costs and gives. */
export async function oneTimeItem(kind: "pack" | "deal", id: string) {
  await loadPricing();
  if (kind === "pack") {
    const p = findPack(id);
    if (!p || p.active === false) throw new HttpError(400, "unavailable");
    return { name: `${site} — ${p.credits} credits`, priceUsd: p.priceUsd, credits: p.credits, productId: p.id };
  }
  const d = await db.deal.findUnique({ where: { id } });
  if (!d || !d.active || (d.endsAt && d.endsAt < new Date()) || !d.priceUsd || d.credits <= 0) throw new HttpError(400, "deal_unavailable");
  return { name: `${site} — ${d.title}`.slice(0, 120), priceUsd: d.priceUsd, credits: d.credits, productId: `deal_${d.id}` };
}
