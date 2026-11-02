// Saved team rosters ("My teams").
export type RosterPlayer = { num: string; name: string; pos: string };

export const MAX_ROSTER = 40;

export function parseRoster(json: string | null | undefined): RosterPlayer[] {
  if (!json) return [];
  try {
    const a = JSON.parse(json);
    return Array.isArray(a)
      ? a
          .map((p) => ({ num: String(p?.num ?? "").slice(0, 3), name: String(p?.name ?? "").slice(0, 30), pos: String(p?.pos ?? "").slice(0, 4).toUpperCase() }))
          .filter((p) => p.name.trim())
          .slice(0, MAX_ROSTER)
      : [];
  } catch {
    return [];
  }
}

/** "10 Bryant ST" → { num: "10", name: "Bryant", pos: "ST" } (number and position optional). */
export function parseLine(line: string, knownPos?: Set<string>): RosterPlayer {
  const parts = line.trim().split(/\s+/);
  let num = "";
  let pos = "";
  if (parts.length > 1 && /^\d{1,3}$/.test(parts[0])) num = parts.shift()!;
  const last = parts[parts.length - 1]?.toUpperCase();
  if (parts.length > 1 && last && (knownPos ? knownPos.has(last) : /^[A-Z]{2,3}$/.test(last))) pos = parts.pop()!.toUpperCase();
  return { num, name: parts.join(" ").slice(0, 30), pos };
}

/** Adds new players / updates number+position of existing ones (matched by name). */
export function mergeRoster(base: RosterPlayer[], add: RosterPlayer[]): RosterPlayer[] {
  const out = base.map((p) => ({ ...p }));
  for (const p of add) {
    if (!p.name.trim()) continue;
    const hit = out.find((o) => o.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (hit) {
      if (p.num) hit.num = p.num;
      if (p.pos) hit.pos = p.pos;
    } else out.push({ ...p });
  }
  return out.slice(0, MAX_ROSTER);
}
