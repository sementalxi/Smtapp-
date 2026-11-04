// Formations: rows from the goalkeeper (back) to the attack (front), with standard position codes.
export const FORMATION_ROWS: Record<string, string[][]> = {
  "4-3-3": [["GK"], ["RB", "CB", "CB", "LB"], ["CM", "CM", "CM"], ["RW", "ST", "LW"]],
  "4-4-2": [["GK"], ["RB", "CB", "CB", "LB"], ["RM", "CM", "CM", "LM"], ["ST", "ST"]],
  "4-2-3-1": [["GK"], ["RB", "CB", "CB", "LB"], ["CDM", "CDM"], ["RW", "CAM", "LW"], ["ST"]],
  "4-1-2-1-2": [["GK"], ["RB", "CB", "CB", "LB"], ["CDM"], ["CM", "CM"], ["CAM"], ["ST", "ST"]],
  "3-5-2": [["GK"], ["CB", "CB", "CB"], ["RWB", "CM", "CDM", "CM", "LWB"], ["ST", "ST"]],
  "3-4-3": [["GK"], ["CB", "CB", "CB"], ["RM", "CM", "CM", "LM"], ["RW", "ST", "LW"]],
  "5-3-2": [["GK"], ["RWB", "CB", "CB", "CB", "LWB"], ["CM", "CM", "CM"], ["ST", "ST"]],
  "4-5-1": [["GK"], ["RB", "CB", "CB", "LB"], ["RM", "CM", "CDM", "CM", "LM"], ["ST"]],
};

export type Slot = { num: string; name: string; photo?: string; club?: string; logo?: string };

/** Flat list of positions in order (GK first). */
export const positionsFor = (formation: string) => (FORMATION_ROWS[formation] ?? []).flat();

/** "9 Bryant ST" lines for the AI, in formation order. */
export function slotsToLines(formation: string, slots: Slot[]) {
  return positionsFor(formation)
    .map((pos, i) => ({ pos, s: slots[i] }))
    .filter((x) => x.s?.name.trim())
    .map((x) => [x.s.num.trim(), x.s.name.trim(), x.pos].filter(Boolean).join(" "));
}


/** Team of the week: "GAMERTAG · 104 PTS · ST" lines (the second part is the points or club line, may be empty), in formation order. */
export function slotsToTotwLines(formation: string, slots: Slot[]) {
  return positionsFor(formation)
    .map((pos, i) => ({ pos, s: slots[i] }))
    .filter((x) => x.s?.name.trim())
    .map((x) => {
      const clean = (v?: string) => (v ?? "").trim().replace(/\s*·\s*/g, " ");
      const pts = clean(x.s.num);
      const sub = [clean(x.s.club), pts ? (/pts|points/i.test(pts) ? pts : `${pts} PTS`) : ""].filter(Boolean).join(" · ");
      return `${clean(x.s.name)} · ${sub} · ${x.pos}`;
    });
}

/** The photo for each line of slotsToTotwLines (same order; "" = none). */
export function slotsToPhotos(formation: string, slots: Slot[]) {
  return positionsFor(formation)
    .map((pos, i) => slots[i])
    .filter((s) => s?.name.trim())
    .map((s) => s.photo ?? "");
}

/** The club crest for each line of slotsToTotwLines (same order; "" = none). */
export function slotsToLogos(formation: string, slots: Slot[]) {
  return positionsFor(formation)
    .map((pos, i) => slots[i])
    .filter((s) => s?.name.trim())
    .map((s) => (s.club?.trim() ? s.logo ?? "" : ""));
}

/** Reads a team-of-the-week line back: gamertag, the sub line (points / club) and the position code. */
export function parseTotwLine(line: string): { name: string; sub: string; pos: string; pts: number | null } {
  const parts = line.split("·").map((x) => x.trim());
  let name = parts[0] ?? "";
  let sub = parts.length > 2 ? parts.slice(1, -1).filter(Boolean).join(" · ") : "";
  let pos = parts.length > 1 ? parts[parts.length - 1] : "";
  if (parts.length === 1) {
    // Free text: "GAMERTAG 104 PTS ST" — the last token is the position when it is a known code.
    const t = line.trim().split(/\s+/);
    if (t.length > 1 && /^[A-Z]{2,3}$/.test(t[t.length - 1])) pos = t.pop()!;
    name = t.shift() ?? "";
    sub = t.join(" ");
  }
  const m = sub.match(/(\d+)\s*(?:pts|points|pt)\b/i) ?? (/^\d+$/.test(sub) ? [sub, sub] : null);
  return { name, sub, pos: pos.toUpperCase(), pts: m ? Number(m[1]) : null };
}
