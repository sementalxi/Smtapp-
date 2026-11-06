// Where KIXO's exact standings table goes on the poster (fractions of width / height) — shared by the prompt
// builder (the AI leaves that area empty) and the table renderer.
export function tableBox(wide: boolean) {
  return wide ? { x: 0.4, y: 0.1, w: 0.56, h: 0.8 } : { x: 0.06, y: 0.39, w: 0.88, h: 0.48 };
}

/** The same box, in words for the image model. */
export function tableAreaText(wide: boolean) {
  const b = tableBox(wide);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return wide
    ? `the rectangle from ${pct(b.x)} to ${pct(b.x + b.w)} of the width and from ${pct(b.y)} to ${pct(b.y + b.h)} of the height (the right side); the title block, the small league logo, the week line and the accent lines sit on the LEFT ${pct(b.x - 0.04)} of the width`
    : `the rectangle from ${pct(b.x)} to ${pct(b.x + b.w)} of the width and from ${pct(b.y)} to ${pct(b.y + b.h)} of the height; EVERYTHING written — the title, the small league logo, the league line, the week / date line and the accent lines — sits ABOVE it and ENDS above ${pct(b.y - 0.03)} of the height (nothing written inside or below the table area), the footer line alone along the bottom ${pct(1 - b.y - b.h - 0.02)}`;
}
