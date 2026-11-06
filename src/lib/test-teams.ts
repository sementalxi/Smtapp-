// Test data for standings posters: 16 fictional teams with their own crests (public/refs/test-crests) and a random,
// believable table — so a style can be tried without typing a league. Used by "My leagues" and the creator.

export type TestRow = { team: string; p: string; w: string; d: string; l: string; gd: string; pts: string };

export const TEST_TEAMS: { name: string; logoUrl: string }[] = [
  ["neon-wolves", "Neon Wolves"],
  ["blitz-fc", "Blitz FC"],
  ["iron-lions", "Iron Lions"],
  ["storm-riders", "Storm Riders"],
  ["royal-vipers", "Royal Vipers"],
  ["shadow-kings", "Shadow Kings"],
  ["golden-eagles", "Golden Eagles"],
  ["crimson-sharks", "Crimson Sharks"],
  ["frost-giants", "Frost Giants"],
  ["thunder-xi", "Thunder XI"],
  ["phantom-fc", "Phantom FC"],
  ["apex-titans", "Apex Titans"],
  ["inferno-united", "Inferno United"],
  ["venom-city", "Venom City"],
  ["lunar-knights", "Lunar Knights"],
  ["vortex-esports", "Vortex Esports"],
].map(([slug, name]) => ({ name, logoUrl: `/refs/test-crests/${slug}.png` }));

/** The crest of a test team (by name), or "" for any other team. */
export function testCrest(name: string): string {
  const k = name.trim().toLowerCase();
  return TEST_TEAMS.find((t) => t.name.toLowerCase() === k)?.logoUrl ?? "";
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/**
 * A random league table: `count` different test teams, everyone with about the same games played, wins / draws /
 * losses that add up, goal difference that follows the results, points = 3 per win + 1 per draw, sorted like a
 * real table (points, then goal difference, then wins).
 */
export function randomTestTable(count = 10): TestRow[] {
  const n = Math.max(2, Math.min(TEST_TEAMS.length, Math.round(count)));
  const teams = [...TEST_TEAMS].sort(() => Math.random() - 0.5).slice(0, n);
  const played = rnd(6, 14);
  const rows = teams.map((t, i) => {
    const p = Math.max(1, played - (Math.random() < 0.25 ? 1 : 0));
    // stronger teams near the top of the shuffled list, so the table has a real spread
    const strength = 1 - i / n + (Math.random() - 0.5) * 0.35;
    const w = Math.max(0, Math.min(p, Math.round(p * Math.max(0, Math.min(1, strength)) * 0.85 + rnd(-1, 1))));
    const d = Math.max(0, Math.min(p - w, rnd(0, Math.max(0, Math.round((p - w) * 0.5)))));
    const l = p - w - d;
    const gd = (w - l) * rnd(1, 3) + rnd(-2, 2);
    return { team: t.name, p, w, d, l, gd, pts: w * 3 + d };
  });
  rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.w - a.w);
  return rows.map((r) => ({ team: r.team, p: String(r.p), w: String(r.w), d: String(r.d), l: String(r.l), gd: String(r.gd), pts: String(r.pts) }));
}

/** sessionStorage key: the test table "My leagues" hands to the creator (never saved to the league). */
export const testTableKey = (leagueId: string) => `kixo_test_table:${leagueId}`;
