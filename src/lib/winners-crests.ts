// Winners showcase: the crest of each winning team, matched by name from the user's saved teams — so a poster
// edited later (new names typed) still gets its crests, and the creator's own matches are kept.
import { db } from "./db";
import type { BannerInputs } from "./templates";

export async function fillWinnerCrests(userId: string, i: BannerInputs): Promise<BannerInputs> {
  const winners = (i.winners ?? []).map((w) => w.trim());
  if (!winners.length) return { ...i, winnerLogos: [] };
  const logos = winners.map((_, n) => i.winnerLogos?.[n] ?? "");
  if (!logos.some((u, n) => !u && winners[n])) return { ...i, winnerLogos: logos };
  const teams: { name: string; logoUrl: string | null }[] = await db.savedItem.findMany({ where: { userId, kind: "team" }, select: { name: true, logoUrl: true } }).catch(() => []);
  const byName = new Map<string, string>(teams.map((t) => [t.name.trim().toLowerCase(), t.logoUrl ?? ""]));
  return { ...i, winnerLogos: winners.map((w, n) => logos[n] || byName.get(w.toLowerCase()) || "") };
}
