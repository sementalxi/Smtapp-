// Where KIXO's winners grid (the wall of frames) goes on a winners-showcase poster, per format — shared by the
// prompt builder (which tells the AI to leave that area empty) and the grid renderer (which draws the frames there).
export type WinnersFormat = "post" | "story" | "banner" | "square";

/** The grid's rectangle as fractions of the poster's width / height. */
export function winnersBox(format?: WinnersFormat | null) {
  // Bands: the headline above the wall, the bottom title and the emblem below it — the AI is told the same numbers.
  if (format === "banner") return { x: 0.36, y: 0.12, w: 0.61, h: 0.78 };
  if (format === "story") return { x: 0.08, y: 0.27, w: 0.84, h: 0.52 };
  if (format === "square") return { x: 0.08, y: 0.27, w: 0.84, h: 0.51 };
  return { x: 0.11, y: 0.27, w: 0.78, h: 0.52 };
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
  const area = `the rectangle from ${pct(b.x)} to ${pct(b.x + b.w)} of the width and from ${pct(b.y)} to ${pct(b.y + b.h)} of the height`;
  return format === "banner"
    ? `${area} (the right side); the headline, the bottom title and the league emblem all sit on the LEFT ${pct(b.x - 0.04)} of the width`
    : `${area} (the middle of the poster). The HEADLINE lives in the top band ONLY — between 4% and ${pct(b.y - 0.03)} of the height — and must END above ${pct(b.y - 0.02)} (make it smaller or on two lines if it must); the BOTTOM TITLE and the league emblem live in the bottom band ONLY — their top edge below ${pct(b.y + b.h + 0.02)} of the height; nothing written, no crown, no laurel and no emblem may touch the rectangle`;
}
