/** Where KIXO's exact regions table goes on a qualifiers poster (fractions of width / height), per format. */
export function qualTableBox(format?: "post" | "story" | "banner" | "square" | null) {
  if (format === "banner") return { x: 0.56, y: 0.14, w: 0.4, h: 0.72 };
  if (format === "story") return { x: 0.5, y: 0.36, w: 0.46, h: 0.34 };
  return { x: 0.52, y: 0.3, w: 0.44, h: 0.46 };
}

/** The same box, in words for the image model. */
export function qualTableAreaText(format?: "post" | "story" | "banner" | "square" | null) {
  const b = qualTableBox(format);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return `the rectangle from ${pct(b.x)} to ${pct(b.x + b.w)} of the width and from ${pct(b.y)} to ${pct(b.y + b.h)} of the height (the right side)`;
}
