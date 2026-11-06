// Winners showcase grid: KIXO draws the wall of frames itself — bevelled metal frames in the style's accent with
// a spotlight in every box, the winning teams' real crests as 3D emblems and their exact names in the first
// boxes, the rest left empty for the next winners — and places it on the AI-made background, which leaves that
// area empty (see winners-box.ts). The band is re-measured on the finished picture, because the AI's headline
// and bottom title often spill into it. Fonts come from Google Fonts at run time, like the standings table.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cutoutCached } from "./cutout";
import { googleFont } from "./standings-table";
import { legibleAccent } from "./legible";
import { emboss3d } from "./stamp";
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

type Box = { x: number; y: number; w: number; h: number };
type Cell = { x: number; y: number; w: number; h: number; plate: { x: number; y: number; w: number; h: number }; crest: { cx: number; cy: number; w: number; h: number } };

/** The frames' rectangles on a poster of this size, inside the given band. */
function cellsFor(W: number, H: number, spec: WinnersSpec, box: Box): { cells: Cell[]; sw: number } {
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
    const plateH = h * 0.21;
    const plate = { x: x + w * 0.08, y: y + h - plateH - h * 0.075, w: w * 0.84, h: plateH };
    const crestTop = y + h * 0.08;
    const crestH = plate.y - crestTop - h * 0.02;
    cells.push({ x, y, w, h, plate, crest: { cx: x + w / 2, cy: crestTop + crestH / 2, w: Math.min(w * 0.62, crestH * 1.5), h: crestH } });
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
  return `<path d="${cup} ${stem} ${base}" fill="url(#metal)" filter="url(#soft)"/><path d="${handles}" fill="none" stroke="url(#metal)" stroke-width="${(6 * s).toFixed(1)}" stroke-linecap="round"/>`;
}

/**
 * The whole wall of frames as one SVG the size of the poster (transparent outside the frames). Each frame is a
 * thick bevelled metal band (light top-left → accent → dark bottom-right) with a highlight and a shadow edge,
 * a second thin rim, a drop shadow so it sits in the scene, a dark glass inside with a spotlight cone from the
 * lamp tab at the top, a gloss across the top and an inner shadow, and a metal-rimmed name plate at the bottom.
 */
function framesSvg(W: number, H: number, spec: WinnersSpec, cells: Cell[], sw: number) {
  const accent = legibleAccent(spec.accent);
  const light = mix(accent, "#ffffff", 0.62);
  const lighter = mix(accent, "#ffffff", 0.85);
  const dark = mix(accent, "#000000", 0.55);
  const darker = mix(accent, "#000000", 0.78);
  const blur = Math.max(4, cells[0].h * 0.04);
  const parts: string[] = [];
  cells.forEach((cell, k) => {
    const { x, y, w, h, plate } = cell;
    const c = Math.min(w, h) * 0.13;
    const band = sw * 3; // the metal band's thickness
    const outer = oct(x, y, w, h, c);
    const inner = oct(x + band, y + band, w - band * 2, h - band * 2, c * 0.72);
    const filled = !!spec.winners[k];
    const tabW = w * 0.16;
    const tabH = h * 0.06;
    parts.push(
      // drop shadow + glow, so the frame sits in the scene
      `<path d="${oct(x, y + sw * 1.2, w, h, c)}" fill="#000000" fill-opacity="0.55" filter="url(#shadow)"/>`,
      `<path d="${outer}" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="${(sw * 2.4).toFixed(1)}" filter="url(#glow)"/>`,
      // the metal band (a dark outline outside it for definition)
      `<path d="${oct(x - 1, y - 1, w + 2, h + 2, c)}" fill="none" stroke="#000000" stroke-opacity="0.55" stroke-width="2"/>`,
      `<path d="${outer}" fill="url(#metal)"/>`,
      `<path d="${outer}" fill="none" stroke="${lighter}" stroke-opacity="0.7" stroke-width="${Math.max(1, sw * 0.35).toFixed(1)}"/>`,
      `<path d="${oct(x + band * 0.5, y + band * 0.5, w - band, h - band, c * 0.86)}" fill="none" stroke="${darker}" stroke-opacity="0.6" stroke-width="${Math.max(1, sw * 0.3).toFixed(1)}"/>`,
      `<path d="${oct(x + band * 0.5, y + band * 0.5, w - band, h - band, c * 0.86)}" fill="none" stroke="${light}" stroke-opacity="0.55" stroke-width="${Math.max(1, sw * 0.22).toFixed(1)}" transform="translate(${(-sw * 0.2).toFixed(1)} ${(-sw * 0.2).toFixed(1)})"/>`,
      // the glass inside: dark, lit from the top, with a cone from the lamp
      `<path d="${inner}" fill="#05050c" fill-opacity="0.68"/>`,
      `<path d="${inner}" fill="url(#spot)"/>`,
      `<polygon points="${(x + w / 2 - w * 0.045).toFixed(1)},${(y + band).toFixed(1)} ${(x + w / 2 + w * 0.045).toFixed(1)},${(y + band).toFixed(1)} ${(x + w * 0.8).toFixed(1)},${(y + h - band).toFixed(1)} ${(x + w * 0.2).toFixed(1)},${(y + h - band).toFixed(1)}" fill="${lighter}" fill-opacity="0.08"/>`,
      `<path d="${inner}" fill="none" stroke="#000000" stroke-opacity="0.75" stroke-width="${(sw * 1.4).toFixed(1)}" filter="url(#inset)"/>`,
      `<path d="${inner}" fill="none" stroke="${darker}" stroke-opacity="0.9" stroke-width="${Math.max(1, sw * 0.4).toFixed(1)}"/>`,
      `<path d="${oct(x + band, y + band, w - band * 2, (h - band * 2) * 0.42, c * 0.72)}" fill="url(#gloss)"/>`,
      // the lamp tab at the top with its bright bulb
      `<rect x="${(x + w / 2 - tabW / 2).toFixed(1)}" y="${(y - tabH * 0.45).toFixed(1)}" width="${tabW.toFixed(1)}" height="${tabH.toFixed(1)}" rx="${(tabH / 3).toFixed(1)}" fill="url(#metal)" stroke="${lighter}" stroke-opacity="0.6" stroke-width="1"/>`,
      `<circle cx="${(x + w / 2).toFixed(1)}" cy="${(y + band + tabH * 0.15).toFixed(1)}" r="${(tabH * 0.26).toFixed(1)}" fill="${lighter}" fill-opacity="0.95" filter="url(#soft)"/>`,
      // the name plate
      `<path d="${oct(plate.x, plate.y, plate.w, plate.h, c * 0.42)}" fill="#000000" fill-opacity="${filled ? 0.62 : 0.32}" stroke="url(#metal)" stroke-opacity="${filled ? 1 : 0.55}" stroke-width="${(sw * 0.7).toFixed(1)}"/>`,
      `<path d="${oct(plate.x + sw * 0.6, plate.y + sw * 0.6, plate.w - sw * 1.2, plate.h - sw * 1.2, c * 0.36)}" fill="none" stroke="${darker}" stroke-opacity="0.7" stroke-width="1"/>`,
    );
    if (filled && !spec.winners[k].crest) parts.push(trophy(cell.crest.cx, cell.crest.cy, Math.min(cell.crest.w, cell.crest.h) * 0.9));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.28" stop-color="${accent}"/><stop offset="0.5" stop-color="${lighter}"/><stop offset="0.68" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="spot" cx="0.5" cy="0" r="0.85"><stop offset="0" stop-color="${lighter}" stop-opacity="0.5"/><stop offset="0.4" stop-color="${accent}" stop-opacity="0.14"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur.toFixed(1)}"/></filter>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="${(blur * 0.9).toFixed(1)}"/></filter>
<filter id="inset" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(sw * 1.2).toFixed(1)}"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(sw * 0.5).toFixed(1)}"/></filter>
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

/** A crest fitted into its frame as a 3D emblem (glow, shadow, extrusion, bevel, sheen), ready to composite. */
async function crestLayer(url: string, w: number, h: number, accent: string): Promise<{ png: Buffer; w: number; h: number } | null> {
  try {
    const bytes = await cutoutCached(url); // just the emblem — no white / black square behind it
    const img = await sharp(bytes).resize(Math.round(w), Math.round(h), { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const m = await sharp(img).metadata();
    const iw = m.width ?? Math.round(w);
    const ih = m.height ?? Math.round(h);
    try {
      const { png, pad } = await emboss3d(img, iw, ih, rgb(legibleAccent(accent)));
      return { png, w: iw + pad * 2, h: ih + pad * 2 };
    } catch (e) {
      console.error("3D crest in the showcase failed (flat crest placed instead)", e);
    }
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

/**
 * Measures where the AI really left the middle empty: its headline often runs lower and its bottom title higher
 * than asked. Rows of the picture are scored by edge energy (lettering = busy, the calm darker area = quiet);
 * a busy run just under the band's top pushes the top down, one just above its bottom pulls the bottom up —
 * each by at most ~14% of the height, the band never shorter than 38%.
 */
async function calmBand(poster: Buffer, W: number, H: number, box: Box): Promise<Box> {
  try {
    const sw = 320;
    const sh = Math.max(64, Math.round((H * sw) / W));
    const { data } = await sharp(poster).resize(sw, sh, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
    const x0 = Math.round((box.x + 0.05) * sw);
    const x1 = Math.round((box.x + box.w - 0.05) * sw);
    const energy = new Float32Array(sh);
    for (let y = 1; y < sh - 1; y++) {
      let s = 0;
      for (let x = x0; x < x1; x++) {
        const i = y * sw + x;
        s += Math.abs(data[i + 1] - data[i]) + Math.abs(data[i + sw] - data[i]);
      }
      energy[y] = s / Math.max(1, x1 - x0);
    }
    const win = Math.max(1, Math.round(sh * 0.012));
    const sm = new Float32Array(sh);
    for (let y = 0; y < sh; y++) {
      let s = 0;
      let n = 0;
      for (let k = -win; k <= win; k++) {
        const yy = y + k;
        if (yy >= 1 && yy < sh - 1) {
          s += energy[yy];
          n++;
        }
      }
      sm[y] = n ? s / n : 0;
    }
    const top0 = box.y;
    const bot0 = box.y + box.h;
    const mid = Array.from(sm.slice(Math.round((top0 + 0.15) * sh), Math.round((bot0 - 0.15) * sh))).sort((a, b) => a - b);
    const baseline = mid[Math.floor(mid.length / 2)] ?? 0;
    const thr = Math.max(baseline * 2.2, 10);
    const runs = (a: number, b: number) => {
      const out: { s: number; e: number }[] = [];
      let start = -1;
      for (let y = a; y <= b; y++) {
        const on = y < b && sm[y] > thr;
        if (on && start < 0) start = y;
        if (!on && start >= 0) {
          out.push({ s: start, e: y });
          start = -1;
        }
      }
      return out.filter((r) => r.e - r.s >= sh * 0.012);
    };
    let top = top0;
    let bottom = bot0;
    const topRuns = runs(Math.round(top0 * sh), Math.round((top0 + 0.14) * sh));
    if (topRuns.length) top = Math.min(top0 + 0.14, topRuns[topRuns.length - 1].e / sh + 0.015);
    const botRuns = runs(Math.round(Math.max(top + 0.38, bot0 - 0.17) * sh), Math.round(bot0 * sh));
    if (botRuns.length) bottom = Math.max(top + 0.38, botRuns[0].s / sh - 0.015);
    return { x: box.x, y: top, w: box.w, h: bottom - top };
  } catch {
    return box;
  }
}

/** Places the wall of frames, the crests and the names on the finished background. */
export async function overlayWinnersGrid(poster: Buffer, spec: WinnersSpec): Promise<Buffer> {
  const { posterAccent } = await import("./ref-palette");
  spec = { ...spec, accent: await posterAccent(poster, spec.accent) }; // the frames take the poster's own colour
  const meta = await sharp(poster).metadata();
  const W = meta.width ?? 1600;
  const H = meta.height ?? 2000;
  const box = spec.format === "banner" ? winnersBox(spec.format) : await calmBand(poster, W, H, winnersBox(spec.format));
  const { cells, sw } = cellsFor(W, H, spec, box);
  const frames = await sharp(Buffer.from(framesSvg(W, H, spec, cells, sw))).png().toBuffer();
  const crests = await Promise.all(cells.map((cell, k) => (spec.winners[k]?.crest ? crestLayer(spec.winners[k].crest!, cell.crest.w, cell.crest.h, spec.accent) : Promise.resolve(null))));
  const composites: { input: Buffer; left: number; top: number }[] = [{ input: frames, left: 0, top: 0 }];
  crests.forEach((c, k) => {
    if (!c) return;
    composites.push({ input: c.png, left: Math.round(cells[k].crest.cx - c.w / 2), top: Math.round(cells[k].crest.cy - c.h / 2) });
  });
  const names = cells.map((cell, k) => (spec.winners[k] ? { x: cell.plate.x, y: cell.plate.y, w: cell.plate.w, h: cell.plate.h, text: spec.winners[k].name } : null)).filter((n): n is NonNullable<typeof n> => !!n);
  if (names.length) composites.push({ input: await renderNames(W, H, names), left: 0, top: 0 });
  return sharp(poster).composite(composites).png().toBuffer();
}
