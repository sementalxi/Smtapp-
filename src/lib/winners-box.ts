// Where KIXO's winners grid (the wall of frames) goes on a winners-showcase poster, per format — shared by the
// prompt builder (which tells the AI to leave that area empty) and the grid renderer (which draws the frames there).
export type WinnersFormat = "post" | "story" | "banner" | "square";

/** The grid's rectangle as fractions of the poster's width / height. */
export function winnersBox(format?: WinnersFormat | null) {
  if (format === "banner") return { x: 0.36, y: 0.12, w: 0.61, h: 0.78 };
  if (format === "story") return { x: 0.08, y: 0.25, w: 0.84, h: 0.56 };
  if (format === "square") return { x: 0.08, y: 0.25, w: 0.84, h: 0.55 };
  return { x: 0.11, y: 0.235, w: 0.78, h: 0.59 };
}

/** How many frames fit: the columns for this many boxes, and the rows that come out (the grid is always full). */
export function winnersGrid(format: WinnersFormat | null | undefined, boxes: number) {
  const n = Math.max(1, Math.min(40, Math.round(boxes) || 15));
  const cols = format === "banner" ? (n <= 12 ? 4 : n <= 20 ? 5 : n <= 30 ? 6 : 7) : n <= 18 ? 3 : n <= 32 ? 4 : 5;
  const rows = Math.ceil(n / cols);
  return { cols, rows, cells: cols * rows };
}

/** The frame counts the creator offers (full grids only). */
export const WINNERS_BOX_OPTIONS = [6, 9, 12, 15, 18, 20, 24, 28, 32];

/** The grid area, in words for the image model. */
export function winnersAreaText(format?: WinnersFormat | null) {
  const b = winnersBox(format);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return `the rectangle from ${pct(b.x)} to ${pct(b.x + b.w)} of the width and from ${pct(b.y)} to ${pct(b.y + b.h)} of the height${format === "banner" ? " (the right side)" : " (the middle of the poster)"}`;
}
