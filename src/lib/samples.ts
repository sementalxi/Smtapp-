import { BannerInputs, EMPTY_INPUTS, LayoutKind } from "./templates";

/** Placeholder text used for template previews. */
export const SAMPLE_INPUTS: Record<LayoutKind, BannerInputs> = {
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
};

export interface ClientTemplate {
  id: string;
  slug: string;
  name: string;
  nameEs: string;
  layout: LayoutKind;
  style: import("./templates").TemplateStyle;
  cost: number;
}
