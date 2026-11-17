// KIXO remembers the standings tables it made for each league (per account + league name), so the next table
// shows ▲/▼ (places moved since the previous table) and each team's form (the results added since then) by itself
// — when the rows don't already carry "FORM …" / "MOVE …". Remaking the same table keeps its arrows.
import { createHash } from "crypto";
import { db } from "./db";

type Snap = Record<string, { pos: number; w: number; d: number; l: number; form: string }>;

const num = (line: string, k: string) => Number(line.match(new RegExp(`·\\s*${k}\\s+(\\d+)`, "i"))?.[1] ?? NaN);
const teamOf = (line: string) => line.split("·")[0].replace(/^\s*\d+\.\s*/, "").trim().toLowerCase();
const same = (a: Snap, b: Snap) => Object.keys(b).length > 0 && Object.keys(a).length === Object.keys(b).length && Object.keys(b).every((t) => a[t] && a[t].pos === b[t].pos && a[t].w === b[t].w && a[t].d === b[t].d && a[t].l === b[t].l);

export async function withHistory(userId: string, league: string, lines: string[]): Promise<string[]> {
  const filled = lines.filter((l) => l.trim());
  if (filled.length < 2 || filled.some((l) => /·\s*(FORM|MOVE)\b/i.test(l))) return lines;
  const key = `tablehist:${createHash("sha1").update(`${userId}|${league.trim().toLowerCase() || "-"}`).digest("hex").slice(0, 24)}`;
  let saved: { base: Snap; cur: Snap } = { base: {}, cur: {} };
  try {
    saved = { base: {}, cur: {}, ...(JSON.parse((await db.setting.findUnique({ where: { key } }))?.value ?? "{}") as object) };
  } catch {
    /* start fresh */
  }
  // the incoming table, without extras
  const now: Snap = {};
  let pos = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    pos += 1;
    const [w, d, l] = ["W", "D", "L"].map((k) => num(line, k));
    now[teamOf(line)] = { pos, w: Number.isFinite(w) ? w : 0, d: Number.isFinite(d) ? d : 0, l: Number.isFinite(l) ? l : 0, form: "" };
  }
  // The same table again: compare with the one before it. A new table: the last one becomes the reference.
  const remake = same(saved.cur, now);
  const prev = remake ? saved.base : saved.cur;
  for (const [team, r] of Object.entries(now)) {
    const p = prev[team];
    let form = p?.form ?? "";
    if (p) {
      const add = "W".repeat(Math.max(0, r.w - p.w)) + "D".repeat(Math.max(0, r.d - p.d)) + "L".repeat(Math.max(0, r.l - p.l));
      if (add.length <= 3) form = (form + add).slice(-3);
    }
    r.form = form;
  }
  if (!remake) {
    const value = JSON.stringify({ base: saved.cur, cur: now });
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }).catch(() => {});
  }
  return lines.map((line) => {
    if (!line.trim()) return line;
    const team = teamOf(line);
    const r = now[team];
    const p = prev[team];
    let extra = r.form ? ` · FORM ${r.form}` : "";
    if (p && p.pos !== r.pos) extra += ` · MOVE ${p.pos > r.pos ? "+" : "-"}${Math.abs(p.pos - r.pos)}`;
    return line + extra;
  });
}
