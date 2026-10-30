// Admin "free studio": make any flyer / logo / graphic with the image AI.
export const STUDIO_SIZES = {
  square: { label: ["Square 1:1", "Cuadrado 1:1"], sizes: ["1024x1024"] },
  post: { label: ["Post 4:5", "Post 4:5"], sizes: ["1088x1360", "1024x1536"] },
  story: { label: ["Story / TikTok 9:16", "Historia / TikTok 9:16"], sizes: ["1152x2048", "1024x1536"] },
  portrait: { label: ["Flyer 2:3", "Flyer 2:3"], sizes: ["1024x1536"] },
  landscape: { label: ["Banner 3:2", "Banner 3:2"], sizes: ["1536x1024"] },
  wide: { label: ["Wide 16:9 (YouTube / Twitter)", "Ancho 16:9 (YouTube / Twitter)"], sizes: ["2048x1152", "1536x1024"] },
} as const;
export type StudioSize = keyof typeof STUDIO_SIZES;

export const STUDIO_KINDS = {
  flyer: {
    label: ["Flyer / poster", "Flyer / póster"],
    prompt:
      "Design a premium, professional event flyer / poster. Strong visual hierarchy, bold modern typography, cinematic lighting and depth, a rich detailed background (never a plain gradient). Spell every text exactly as given.",
  },
  logo: {
    label: ["Logo", "Logo"],
    prompt:
      "Design a professional, original logo / crest. Clean vector-style shapes, strong silhouette that reads at small sizes, balanced composition centred on a plain dark or simple background, no mock-up scene. Spell any text exactly as given.",
  },
  card: {
    label: ["Player card", "Tarjeta de jugador"],
    prompt:
      "Design a premium sports player card graphic: the person from the photo as the hero, dynamic cut-out with rim light, bold name lettering, stats styling, rich designed background. Keep the person's face and likeness exactly as in the photo.",
  },
  social: {
    label: ["Social post / announcement", "Post / anuncio"],
    prompt:
      "Design a scroll-stopping social media graphic / announcement. Bold headline, clean layout, high contrast, modern sports-brand look. Spell every text exactly as given.",
  },
  free: { label: ["Anything (only my words)", "Lo que sea (solo mis palabras)"], prompt: "" },
} as const;
export type StudioKind = keyof typeof STUDIO_KINDS;
