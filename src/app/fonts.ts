import { Anton, Barlow, Barlow_Condensed, Bebas_Neue, Montserrat, Permanent_Marker, UnifrakturMaguntia } from "next/font/google";
import type { FontKey } from "@/lib/templates";

export const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--nf-anton" });
export const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--nf-bebas" });
export const gothic = UnifrakturMaguntia({ weight: "400", subsets: ["latin"], variable: "--nf-gothic" });
export const brush = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--nf-brush" });
export const sans = Montserrat({ subsets: ["latin"], variable: "--nf-sans", weight: ["400", "500", "600", "700", "800", "900"] });

// Site UI: broadcast-style condensed titles + clean body
export const ui = Barlow({ subsets: ["latin"], variable: "--nf-ui", weight: ["400", "500", "600", "700"] });
export const uiCond = Barlow_Condensed({ subsets: ["latin"], variable: "--nf-ui-cond", weight: ["600", "700", "800", "900"], style: ["normal", "italic"] });

export const fontVariables = [anton, bebas, gothic, brush, sans, ui, uiCond].map((f) => f.variable).join(" ");

/** CSS font-family strings the canvas renderer uses. */
export const canvasFonts: Record<FontKey, string> = {
  anton: anton.style.fontFamily,
  bebas: bebas.style.fontFamily,
  gothic: gothic.style.fontFamily,
  brush: brush.style.fontFamily,
  sans: sans.style.fontFamily,
};
