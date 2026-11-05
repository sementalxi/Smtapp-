// Shared by the admin Style test page and its server-side runner: the sample and the inputs it produces per poster kind.
export type Sample = {
  photoUrl: string;
  logoUrl: string;
  name: string;
  team: string;
  rival: string;
  position: string;
  number: string;
  tagline: string;
  subtitle: string;
  footer: string;
  competition: string;
  date: string;
  venue: string;
  mascot: string;
  /** Palette for the test: the style's own colours (default, so every style shows as designed), the crest's colours (what users get by default), or a random one. */
  colorMode?: "template" | "team" | "surprise";
  /** How many posters to make at the same time (0 = all at once). */
  parallel?: number;
  /** Synced from a saved league: its logo, its real table (lines like the creator makes), the crests per row, how many advance. */
  leagueLogo?: string;
  standings?: string[];
  tableLogos?: string[];
  qualify?: string;
};

/** A saved league as the style test can use it. */
export type SyncLeague = { id: string; name: string; logoUrl: string; standings: string[]; tableLogos: string[]; teams: { name: string; logoUrl: string }[]; qualify: string; date: string };
/** One of the admin's finished player cards. */
export type SyncCard = { id: string; label: string; thumb: string; photoUrl: string; logoUrl: string; inputs: Partial<Record<"name" | "team" | "position" | "number" | "tagline" | "subtitle" | "footer", string>> };

export type RunItem = { id: string; name: string; layout: string; logoCreate: boolean };
export type Run = {
  id: string;
  userId: string;
  queue: RunItem[];
  next: number; // index of the next style to start
  status: "running" | "paused" | "stopped" | "done";
  startedAt: string;
  sample: Sample;
  parallel: number; // how many at once (0 = all)
  skipped: { templateId: string; error: string; at: string }[]; // styles whose request was refused before a poster existed
  retries?: Record<string, number>; // automatic retries per style after an AI rate limit
  requeued?: string[]; // failed poster ids already handled
};

export const DEFAULT_SAMPLE: Sample = {
  photoUrl: "",
  logoUrl: "",
  name: "KIXO TEST",
  team: "KIXO FC",
  rival: "RIVALS FC",
  position: "ST",
  number: "10",
  tagline: "Welcome",
  subtitle: "New signing",
  footer: "Season 2026",
  competition: "Pro Clubs League",
  date: "Saturday 8 PM",
  venue: "KIXO Arena",
  mascot: "a wolf head",
  colorMode: "template",
  parallel: 0,
};

const ROSTER = ["Alex", "Bruno", "Carlos", "Diego", "Eli", "Fabio", "Gabo", "Hugo", "Iker", "Javi", "Kevin"];
const TOTW_PLAYERS = ["ALEX_GK · 61 PTS · GK", "BRUNO9 · 48 PTS · RB", "CARLOSX · 52 PTS · CB", "DIEGO_DF · 44 PTS · CB", "ELI_LB · 39 PTS · LB", "FABIO10 · 70 PTS · CM", "GABO_CM · 66 PTS · CM", "HUGO_8 · 58 PTS · CM", "IKER_RW · 83 PTS · RW", "JAVI_9 · 104 PTS · ST", "KEVIN_LW · 77 PTS · LW"];
const PLAYERS = ["1 Alex GK", "2 Bruno RB", "3 Carlos CB", "4 Diego CB", "5 Eli LB", "6 Fabio CM", "8 Gabo CM", "10 Hugo CAM", "7 Iker RW", "9 Javi ST", "11 Kevin LW"];

/** Sample inputs for each kind of poster, from one shared sample. */
export function inputsFor(layout: string, s: Sample, logoCreate: boolean): Record<string, unknown> {
  const base = { language: "English", aiCopy: "off", colorMode: s.colorMode || "template", bgPose: "surprise" };
  switch (layout) {
    case "CHAMPIONS":
      return { ...base, headline: "CHAMPIONS", team: s.team, roster: ROSTER, trophy: "surprise", date: s.date, eventName: s.competition };
    case "LINEUP":
      return { ...base, headline: "STARTING XI", team: s.team, formation: "4-3-3", players: PLAYERS, competition: s.competition, date: s.date };
    case "TOTW": {
      // Synced league: the eleven play for the league's real clubs (with their crests).
      const clubs = (s.standings ?? []).map((l) => l.replace(/^\d+\.\s*/, "").split(" · ")[0]).filter(Boolean);
      const players = clubs.length ? TOTW_PLAYERS.map((p, n) => { const [tag, pts, pos] = p.split(" · "); return `${tag} · ${clubs[n % clubs.length]} · ${pts} · ${pos}`; }) : TOTW_PLAYERS;
      const playerLogos = clubs.length ? TOTW_PLAYERS.map((_, n) => s.tableLogos?.[n % clubs.length] ?? "") : [];
      return { ...base, headline: "TEAM OF THE WEEK", formation: "4-3-3", players, playerLogos, competition: s.competition, date: "Week 1 · Division 1", footer: s.footer, ...(s.leagueLogo ? { champLogoUrl: s.leagueLogo } : {}) };
    }
    case "MATCHDAY":
      return { ...base, headline: "MATCH DAY", homeTeam: s.team, awayTeam: s.rival, competition: s.competition, date: s.date, time: "8:00 PM", venue: s.venue };
    case "RESULT":
      return { ...base, headline: "FULL TIME", homeTeam: s.team, awayTeam: s.rival, homeScore: "3", awayScore: "1", scorers: [`${s.name} 23'`, `${s.name} 67'`, "Rival 80'"], competition: s.competition };
    case "EVENT":
      return { ...base, headline: "TOURNAMENT", name: s.competition, subtitle: s.tagline, date: s.date, details: "8:00 PM · Online", prize: "$500", ...(s.leagueLogo ? { champLogoUrl: s.leagueLogo } : {}) };
    case "STANDINGS":
      return {
        ...base,
        headline: "STANDINGS",
        competition: s.competition,
        date: s.date,
        ...(s.leagueLogo ? { champLogoUrl: s.leagueLogo } : {}),
        ...(s.standings?.length ? { tableLogos: s.tableLogos ?? [], qualify: s.qualify ?? "" } : {}),
        standings: s.standings?.length ? s.standings : [`1. ${s.team} · P 10 · W 8 · D 1 · L 1 · GD 18 · PTS 25`, `2. ${s.rival} · P 10 · W 7 · D 1 · L 2 · GD 11 · PTS 22`, "3. Lions · P 10 · W 5 · D 2 · L 3 · GD 4 · PTS 17", "4. Sharks · P 10 · W 4 · D 2 · L 4 · GD -1 · PTS 14", "5. Wolves · P 10 · W 2 · D 1 · L 7 · GD -12 · PTS 7"],
      };
    case "LOGO":
      return logoCreate ? { ...base, team: s.team, subtitle: s.mascot, footer: s.footer } : { ...base, headline: s.tagline, footer: s.footer, team: s.team };
    default:
      return { ...base, name: s.name, team: s.team, position: s.position, number: s.number, tagline: s.tagline, subtitle: s.subtitle, footer: s.footer };
  }
}

const PHOTO_LAYOUTS = ["PLAYER", "CHAMPIONS", "MATCHDAY", "RESULT"];
const CREST_LAYOUTS = ["PLAYER", "CHAMPIONS", "LINEUP", "LOGO"];

/** The request body for POST /api/banners for one style. */
export function bannerBodyFor(t: { id: string; layout: string; logoCreate: boolean }, s: Sample, run: string) {
  return {
    templateId: t.id,
    inputs: inputsFor(t.layout, s, t.logoCreate),
    // Only the kinds whose creator step takes them: a photo for player cards, champions and match posters;
    // a team crest where the creator has a team picker. Standings, team of the week, lineups and events get none.
    photoUrl: PHOTO_LAYOUTS.includes(t.layout) ? s.photoUrl || undefined : undefined,
    logoUrl: CREST_LAYOUTS.includes(t.layout) && !(t.layout === "LOGO" && t.logoCreate) ? s.logoUrl || undefined : undefined,
    mode: "PRO" as const,
    test: true,
    testRun: run,
  };
}
