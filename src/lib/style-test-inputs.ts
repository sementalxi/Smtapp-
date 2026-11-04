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
};

export type RunItem = { id: string; name: string; layout: string; logoCreate: boolean };
export type Run = {
  id: string;
  userId: string;
  queue: RunItem[];
  next: number; // index of the next style to start
  status: "running" | "stopped" | "done";
  startedAt: string;
  sample: Sample;
  skipped: { templateId: string; error: string; at: string }[]; // styles whose request was refused before a poster existed
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
};

const ROSTER = ["Alex", "Bruno", "Carlos", "Diego", "Eli", "Fabio", "Gabo", "Hugo", "Iker", "Javi", "Kevin"];
const PLAYERS = ["1 Alex GK", "2 Bruno RB", "3 Carlos CB", "4 Diego CB", "5 Eli LB", "6 Fabio CM", "8 Gabo CM", "10 Hugo CAM", "7 Iker RW", "9 Javi ST", "11 Kevin LW"];

/** Sample inputs for each kind of poster, from one shared sample. */
export function inputsFor(layout: string, s: Sample, logoCreate: boolean): Record<string, unknown> {
  const base = { language: "English", aiCopy: "off", colorMode: "", bgPose: "style" };
  switch (layout) {
    case "CHAMPIONS":
      return { ...base, headline: "CHAMPIONS", team: s.team, roster: ROSTER, trophy: "surprise", date: s.date, eventName: s.competition };
    case "LINEUP":
      return { ...base, headline: "STARTING XI", team: s.team, formation: "4-3-3", players: PLAYERS, competition: s.competition, date: s.date };
    case "MATCHDAY":
      return { ...base, headline: "MATCH DAY", homeTeam: s.team, awayTeam: s.rival, competition: s.competition, date: s.date, time: "8:00 PM", venue: s.venue };
    case "RESULT":
      return { ...base, headline: "FULL TIME", homeTeam: s.team, awayTeam: s.rival, homeScore: "3", awayScore: "1", scorers: [`${s.name} 23'`, `${s.name} 67'`, "Rival 80'"], competition: s.competition };
    case "EVENT":
      return { ...base, headline: "TOURNAMENT", name: s.competition, subtitle: s.tagline, date: s.date, details: "8:00 PM · Online", prize: "$500" };
    case "STANDINGS":
      return {
        ...base,
        headline: "STANDINGS",
        competition: s.competition,
        date: s.date,
        standings: [`1. ${s.team} · P 10 · W 8 · D 1 · L 1 · GD 18 · PTS 25`, `2. ${s.rival} · P 10 · W 7 · D 1 · L 2 · GD 11 · PTS 22`, "3. Lions · P 10 · W 5 · D 2 · L 3 · GD 4 · PTS 17", "4. Sharks · P 10 · W 4 · D 2 · L 4 · GD -1 · PTS 14", "5. Wolves · P 10 · W 2 · D 1 · L 7 · GD -12 · PTS 7"],
      };
    case "LOGO":
      return logoCreate ? { ...base, team: s.team, subtitle: s.mascot, footer: s.footer } : { ...base, headline: s.tagline, footer: s.footer, team: s.team };
    default:
      return { ...base, name: s.name, team: s.team, position: s.position, number: s.number, tagline: s.tagline, subtitle: s.subtitle, footer: s.footer };
  }
}

/** The request body for POST /api/banners for one style. */
export function bannerBodyFor(t: { id: string; layout: string; logoCreate: boolean }, s: Sample, run: string) {
  return {
    templateId: t.id,
    inputs: inputsFor(t.layout, s, t.logoCreate),
    photoUrl: t.layout === "LOGO" ? undefined : s.photoUrl || undefined,
    logoUrl: t.layout === "LOGO" && t.logoCreate ? undefined : s.logoUrl || undefined,
    mode: "PRO" as const,
    test: true,
    testRun: run,
  };
}
