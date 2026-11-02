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

export type Slot = { num: string; name: string };

/** Flat list of positions in order (GK first). */
export const positionsFor = (formation: string) => (FORMATION_ROWS[formation] ?? []).flat();

/** "9 Bryant ST" lines for the AI, in formation order. */
export function slotsToLines(formation: string, slots: Slot[]) {
  return positionsFor(formation)
    .map((pos, i) => ({ pos, s: slots[i] }))
    .filter((x) => x.s?.name.trim())
    .map((x) => [x.s.num.trim(), x.s.name.trim(), x.pos].filter(Boolean).join(" "));
}

