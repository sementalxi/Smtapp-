// Winners showcase grid: KIXO draws the wall of frames itself — bevelled frames in the style's accent with a
// spotlight in every box, the winning teams' real crests and exact names in the first boxes, the rest left
// empty for the next winners — and places it on the AI-made background, which leaves that area empty
// (see winners-box.ts). Fonts come from Google Fonts at run time, like the standings table.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cutoutCached } from "./cutout";
import { googleFont } from "./standings-table";
import { legibleAccent } from "./legible";
import { winnersBox, winnersGrid, type WinnersFormat } from "./winners-box";
import type { BannerInputs } from "./templates";

export type WinnersSpec = {
  /** The winners in order — box 1 first. */
  winners: { name: string; crest: string | null }[];
  /** How many frames the wall has (rounded up to full rows when drawn). */
  boxes: number;
  accent: string;
  format: WinnersFormat;
};

/** Reads the creator's winners (one per line) and their matched crests into a grid spec. */
export function winnersSpecFrom(i: BannerInputs, accent: string, format: WinnersFormat): WinnersSpec {
  const winners = (i.winners ?? [])
    .map((w, n) => ({ name: w.trim().slice(0, 40), crest: i.winnerLogos?.[n] || null }))
    .filter((w) => w.name)
    .slice(0, 40);
  const boxes = Math.min(40, Math.max(parseInt(i.boxes, 10) || 15, winners.length));
  return { winners, boxes, accent, format };
}

const rgb = (c: string) => {
  const v = parseInt(c.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};
/** c moved k of the way towards t. */
const mix = (c: string, t: string, k: number) => {
  const a = rgb(c);
  const b = rgb(t);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${f(a.r, b.r)}${f(a.g, b.g)}${f(a.b, b.b)}`;
};

type Cell = { x: number; y: number; w: number; h: number; plate: { x: number; y: number; w: number; h: number }; crest: { cx: number; cy: number; w: number; h: number } };

/** The frames' rectangles on a poster of this size. */
function cellsFor(W: number, H: number, spec: WinnersSpec): { cells: Cell[]; sw: number } {
  const box = winnersBox(spec.format);
  const { cols, rows, cells: n } = winnersGrid(spec.format, spec.boxes);
  const gx = Math.round(W * box.x);
  const gy = Math.round(H * box.y);
  const gw = Math.round(W * box.w);
  const gh = Math.round(H * box.h);
  const pitchX = gw / cols;
  const pitchY = gh / rows;
  const gapX = pitchX * 0.065;
  const gapY = pitchY * 0.1;
  const w = pitchX - gapX;
  const h = pitchY - gapY;
  const sw = Math.max(3, Math.min(w, h) * 0.03);
  const cells: Cell[] = [];
  for (let k = 0; k < n; k++) {
    const c = k % cols;
    const r = Math.floor(k / cols);
    const x = gx + gapX / 2 + c * pitchX;
    const y = gy + gapY / 2 + r * pitchY;
    const plateH = h * 0.22;
    const plate = { x: x + w * 0.07, y: y + h - plateH - h * 0.07, w: w * 0.86, h: plateH };
    const crestTop = y + h * 0.06;
    const crestH = plate.y - crestTop - h * 0.015;
    cells.push({ x, y, w, h, plate, crest: { cx: x + w / 2, cy: crestTop + crestH / 2, w: Math.min(w * 0.7, crestH * 1.6), h: crestH } });
  }
  return { cells, sw };
}

const oct = (x: number, y: number, w: number, h: number, c: number) =>
  `M${(x + c).toFixed(1)},${y.toFixed(1)} H${(x + w - c).toFixed(1)} L${(x + w).toFixed(1)},${(y + c).toFixed(1)} V${(y + h - c).toFixed(1)} L${(x + w - c).toFixed(1)},${(y + h).toFixed(1)} H${(x + c).toFixed(1)} L${x.toFixed(1)},${(y + h - c).toFixed(1)} V${(y + c).toFixed(1)} Z`;

/** A trophy silhouette (for a winner without a crest), fitted into a box. */
function trophy(cx: number, cy: number, size: number) {
  const s = size / 100;
  const X = (v: number) => (cx - size / 2 + v * s).toFixed(1);
  const Y = (v: number) => (cy - size / 2 + v * s).toFixed(1);
  const cup = `M${X(22)},${Y(8)} H${X(78)} V${Y(40)} C${X(78)},${Y(62)} ${X(64)},${Y(72)} ${X(50)},${Y(72)} C${X(36)},${Y(72)} ${X(22)},${Y(62)} ${X(22)},${Y(40)} Z`;
  const stem = `M${X(44)},${Y(72)} H${X(56)} V${Y(82)} H${X(44)} Z`;
  const base = `M${X(30)},${Y(82)} H${X(70)} L${X(74)},${Y(94)} H${X(26)} Z`;
  const handles = `M${X(22)},${Y(16)} H${X(9)} C${X(3)},${Y(16)} ${X(2)},${Y(24)} ${X(5)},${Y(32)} C${X(10)},${Y(44)} ${X(16)},${Y(50)} ${X(26)},${Y(53)} M${X(78)},${Y(16)} H${X(91)} C${X(97)},${Y(16)} ${X(98)},${Y(24)} ${X(95)},${Y(32)} C${X(90)},${Y(44)} ${X(84)},${Y(50)} ${X(74)},${Y(53)}`;
  return `<path d="${cup} ${stem} ${base}" fill="url(#rim)"/><path d="${handles}" fill="none" stroke="url(#rim)" stroke-width="${(6 * s).toFixed(1)}" stroke-linecap="round"/>`;
}

/** The whole wall of frames as one SVG the size of the poster (transparent outside the frames). */
function framesSvg(W: number, H: number, spec: WinnersSpec, cells: Cell[], sw: number) {
  const accent = legibleAccent(spec.accent);
  const light = mix(accent, "#ffffff", 0.55);
  const dark = mix(accent, "#000000", 0.5);
  const blur = Math.max(4, cells[0].h * 0.035);
  const parts: string[] = [];
  cells.forEach((cell, k) => {
    const { x, y, w, h, plate } = cell;
    const c = Math.min(w, h) * 0.12;
    const d = oct(x, y, w, h, c);
    const filled = !!spec.winners[k];
    const tabW = w * 0.14;
    const tabH = h * 0.05;
    parts.push(
      `<path d="${d}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="${(sw * 2.4).toFixed(1)}" filter="url(#glow)"/>`,
      `<path d="${d}" fill="#05050c" fill-opacity="0.62"/>`,
      `<path d="${d}" fill="url(#spot)"/>`,
      `<polygon points="${(x + w / 2 - w * 0.05).toFixed(1)},${y.toFixed(1)} ${(x + w / 2 + w * 0.05).toFixed(1)},${y.toFixed(1)} ${(x + w * 0.82).toFixed(1)},${(y + h).toFixed(1)} ${(x + w * 0.18).toFixed(1)},${(y + h).toFixed(1)}" fill="${light}" fill-opacity="0.07"/>`,
      `<path d="${oct(x + sw * 1.8, y + sw * 1.8, w - sw * 3.6, h - sw * 3.6, c * 0.85)}" fill="none" stroke="${dark}" stroke-opacity="0.85" stroke-width="${(sw * 0.6).toFixed(1)}"/>`,
      `<path d="${d}" fill="none" stroke="url(#rim)" stroke-width="${sw.toFixed(1)}"/>`,
      `<rect x="${(x + w / 2 - tabW / 2).toFixed(1)}" y="${(y - tabH * 0.4).toFixed(1)}" width="${tabW.toFixed(1)}" height="${tabH.toFixed(1)}" rx="${(tabH / 3).toFixed(1)}" fill="url(#rim)"/>`,
      `<circle cx="${(x + w / 2).toFixed(1)}" cy="${(y + tabH * 0.6).toFixed(1)}" r="${(tabH * 0.22).toFixed(1)}" fill="${light}" fill-opacity="0.95"/>`,
      `<path d="${oct(plate.x, plate.y, plate.w, plate.h, c * 0.45)}" fill="#000000" fill-opacity="${filled ? 0.6 : 0.3}" stroke="${accent}" stroke-opacity="${filled ? 0.9 : 0.4}" stroke-width="${(sw * 0.55).toFixed(1)}"/>`,
    );
    if (filled && !spec.winners[k].crest) parts.push(trophy(cell.crest.cx, cell.crest.cy, Math.min(cell.crest.w, cell.crest.h) * 0.9));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.45" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="spot" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="${light}" stop-opacity="0.45"/><stop offset="0.45" stop-color="${accent}" stop-opacity="0.12"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(1)}"/></filter>
</defs>
${parts.join("\n")}
</svg>`;
}

/** The winners' names, one centred on each plate, as a transparent layer the size of the poster. */
async function renderNames(W: number, H: number, items: { x: number; y: number; w: number; h: number; text: string }[]): Promise<Buffer> {
  const mont = await googleFont("Montserrat", 800);
  const el = (
    <div style={{ display: "flex", position: "relative", width: W, height: H }}>
      {items.map((it, k) => {
        const text = it.text.toUpperCase();
        const fs = Math.max(10, Math.min(it.h * 0.5, (it.w * 1.45) / Math.max(4, text.length)));
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: it.x,
              top: it.y,
              width: it.w,
              height: it.h,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: fs,
              letterSpacing: 1,
              color: "#ffffff",
              whiteSpace: "nowrap",
              textShadow: "0 2px 6px rgba(0,0,0,0.85)",
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
  const res = new ImageResponse(el, { width: W, height: H, fonts: [{ name: "Montserrat", data: mont, weight: 800, style: "normal" }] });
  return Buffer.from(await res.arrayBuffer());
}

/** A crest fitted into its frame (with a soft shadow under it), ready to composite. */
async function crestLayer(url: string, w: number, h: number): Promise<{ png: Buffer; w: number; h: number } | null> {
  try {
    const bytes = await cutoutCached(url); // just the emblem — no white / black square behind it
    const img = await sharp(bytes).resize(Math.round(w), Math.round(h), { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const m = await sharp(img).metadata();
    const iw = m.width ?? Math.round(w);
    const ih = m.height ?? Math.round(h);
    const pad = Math.round(Math.max(iw, ih) * 0.12);
    const shadow = await sharp(img).ensureAlpha().modulate({ brightness: 0 }).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(pad * 0.45).png().toBuffer();
    const png = await sharp({ create: { width: iw + pad * 2, height: ih + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: shadow, left: 0, top: Math.round(pad * 0.35) },
        { input: img, left: pad, top: pad },
      ])
      .png()
      .toBuffer();
    return { png, w: iw + pad * 2, h: ih + pad * 2 };
  } catch {
    return null;
  }
}

/** Places the wall of frames, the crests and the names on the finished background. */
export async function overlayWinnersGrid(poster: Buffer, spec: WinnersSpec): Promise<Buffer> {
  const meta = await sharp(poster).metadata();
  const W = meta.width ?? 1600;
  const H = meta.height ?? 2000;
  const { cells, sw } = cellsFor(W, H, spec);
  const frames = await sharp(Buffer.from(framesSvg(W, H, spec, cells, sw))).png().toBuffer();
  const crests = await Promise.all(cells.map((cell, k) => (spec.winners[k]?.crest ? crestLayer(spec.winners[k].crest!, cell.crest.w, cell.crest.h) : Promise.resolve(null))));
  const composites: { input: Buffer; left: number; top: number }[] = [{ input: frames, left: 0, top: 0 }];
  crests.forEach((c, k) => {
    if (!c) return;
    composites.push({ input: c.png, left: Math.round(cells[k].crest.cx - c.w / 2), top: Math.round(cells[k].crest.cy - c.h / 2) });
  });
  const names = cells.map((cell, k) => (spec.winners[k] ? { x: cell.plate.x, y: cell.plate.y, w: cell.plate.w, h: cell.plate.h, text: spec.winners[k].name } : null)).filter((n): n is NonNullable<typeof n> => !!n);
  if (names.length) composites.push({ input: await renderNames(W, H, names), left: 0, top: 0 });
  return sharp(poster).composite(composites).png().toBuffer();
}
