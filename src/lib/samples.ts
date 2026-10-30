import { BannerInputs, EMPTY_INPUTS, LayoutKind } from "./templates";

/** Placeholder text used for template previews. */
export const SAMPLE_INPUTS = {
  PLAYER: {
    ...EMPTY_INPUTS,
    name: "XSHADOW_10",
    team: "Renegade XI",
    position: "CAM | MCO",
    number: "10",
    tagline: "Welcome",
    subtitle: "Six Feet Under",
    footer: "Liga Pro Edition",
  },
  CHAMPIONS: {
    ...EMPTY_INPUTS,
    headline: "Champions",
    team: "Blitz FC",
    eventName: "Liga Pro Winners",
    roster: ["Krypto", "Nesta1", "Bryant-GK", "Santxz", "Rogerinho", "Alvarez7", "Silent54", "Guerrero01", "Okkotsu"],
    prize: "$200 Prize",
    footer: "Season 2026",
  },
  EVENT: {
    ...EMPTY_INPUTS,
    headline: "$100 Winner",
    name: "1v1 Ultimate Team",
    subtitle: "Free Entry",
    date: "Fri · Nov 6",
    details: "8 PM",
    footer: "Liga Pro Cup",
  },
} as Record<LayoutKind, BannerInputs>;

Object.assign(SAMPLE_INPUTS, {
  MATCHDAY: { ...EMPTY_INPUTS, headline: "Match Day", name: "Blitz FC vs Renegade XI", subtitle: "Liga Pro", date: "Fri · Nov 6", details: "9 PM", footer: "Season 2026" },
  LINEUP: { ...EMPTY_INPUTS, headline: "Starting XI", name: "Blitz FC", subtitle: "4-3-3", date: "Matchday 7", footer: "Liga Pro" },
  RESULT: { ...EMPTY_INPUTS, headline: "3 - 1", name: "Full Time", subtitle: "Blitz FC vs Renegade XI", footer: "Liga Pro" },
});

export interface ClientTemplate {
  id: string;
  slug: string;
  name: string;
  nameEs: string;
  layout: LayoutKind;
  style: import("./templates").TemplateStyle;
  cost: number;
  thumbUrl?: string | null;
  /** The style has admin-written Pro AI design instructions */
  hasInstructions?: boolean;
  /** "recommended" | "fire" */
  badge?: string | null;
}
