// Ways the member's profile picture is worked into the welcome banner's background (on top of the AI scene, under
// the ring). All done by KIXO with the real picture — nothing is sent to or redrawn by the AI.
import sharp from "sharp";

export const WELCOME_FX = ["none", "blur", "cards", "halftone", "shards", "echo"] as const;
export type WelcomeFx = (typeof WELCOME_FX)[number];

type Geo = { W: number; H: number; cx: number; cy: number; R: number; accent: string };
type Layer = { input: Buffer; left: number; top: number };

const rgbOf = (hex: string) => {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
};

/** Crops an image placed at (left, top) to the banner, so pieces hanging off the edge are allowed. */
async function place(img: Buffer, left: number, top: number, W: number, H: number): Promise<Layer | null> {
  const m = await sharp(img).metadata();
  const w0 = m.width ?? 0, h0 = m.height ?? 0;
  const l = Math.round(left), t = Math.round(top);
  const sx = Math.max(0, -l), sy = Math.max(0, -t);
  const w = Math.min(w0 - sx, W - Math.max(0, l)), h = Math.min(h0 - sy, H - Math.max(0, t));
  if (w <= 0 || h <= 0) return null;
  return { input: await sharp(img).extract({ left: sx, top: sy, width: w, height: h }).png().toBuffer(), left: Math.max(0, l), top: Math.max(0, t) };
}

/** Multiplies an RGBA image's alpha by a mask (an SVG the same size, white = keep). */
async function withMask(img: Buffer, maskSvg: string): Promise<Buffer> {
  return sharp(img).ensureAlpha().composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }]).png().toBuffer();
}

/** Left-side fade: fully there at the left, gone before the name starts (≈ 47% of the width). */
const leftFade = (W: number, H: number, from = 0.3, to = 0.47, max = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${max}"/><stop offset="${from}" stop-color="#fff" stop-opacity="${max}"/><stop offset="${to}" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#l)"/></svg>`;

/** 1 · Blur glow: the picture blown up and softly blurred across the left side, like album art behind a player. */
async function blur({ W, H }: Geo, avatar: Buffer): Promise<Layer[]> {
  const w = Math.round(W * 0.56);
  const img = await sharp(avatar).resize(w, H, { fit: "cover" }).blur(28).modulate({ saturation: 1.5, brightness: 0.85 }).ensureAlpha().png().toBuffer();
  const vignette = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="0.3" stop-color="#000" stop-opacity="0"/><stop offset="0.7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs><rect width="${w}" height="${H}" fill="url(#l)"/></svg>`;
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}"><defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.5"/><stop offset="0.35" stop-color="#000" stop-opacity="0.1"/><stop offset="0.65" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></linearGradient></defs><rect width="${w}" height="${H}" fill="url(#v)"/></svg>`);
  const shaded = await sharp(img).composite([{ input: shade }]).png().toBuffer();
  return [{ input: await withMask(shaded, vignette), left: 0, top: 0 }];
}

/** 2 · Photo cards: two tilted copies of the picture, framed in the accent, fanned out behind the ring. */
async function cards({ W, H, cx, cy, R, accent }: Geo, avatar: Buffer): Promise<Layer[]> {
  const s = Math.round(R * 1.55);
  const rad = Math.round(s * 0.08);
  const b = Math.max(5, Math.round(s * 0.025));
  const card = async (dim: number) => {
    const pic = await sharp(avatar).resize(s, s, { fit: "cover" }).modulate({ brightness: dim }).png().toBuffer();
    const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect x="${b / 2}" y="${b / 2}" width="${s - b}" height="${s - b}" rx="${rad}" fill="none" stroke="${accent}" stroke-width="${b}"/></svg>`);
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${rad}" fill="#fff"/></svg>`);
    const c = await sharp(pic).ensureAlpha().composite([{ input: mask, blend: "dest-in" }, { input: frame }]).png().toBuffer();
    // drop shadow + glow in the accent around the card
    const pad = Math.round(s * 0.18);
    const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s + pad * 2}" height="${s + pad * 2}"><defs><filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(pad * 0.4)}"/></filter></defs><rect x="${pad}" y="${pad + pad * 0.25}" width="${s}" height="${s}" rx="${rad}" fill="#000" fill-opacity="0.75" filter="url(#f)"/><rect x="${pad}" y="${pad}" width="${s}" height="${s}" rx="${rad}" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="${b * 3}" filter="url(#f)"/></svg>`);
    return sharp(glow).composite([{ input: c, left: pad, top: pad }]).png().toBuffer();
  };
  const out: Layer[] = [];
  for (const [deg, dx, dy, dim] of [[-16, -0.62, -0.18, 0.6], [13, 0.72, 0.02, 0.75]] as const) {
    const rot = await sharp(await card(dim)).rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(rot).metadata();
    const l = await place(rot, cx + R * dx - (m.width ?? 0) / 2, cy + R * dy - (m.height ?? 0) / 2, W, H);
    if (l) out.push(l);
  }
  return out;
}

/** 3 · Halftone: the picture as a big pop-art dot screen in the accent, filling the left side. */
async function halftone({ W, H, accent }: Geo, avatar: Buffer): Promise<Layer[]> {
  const w = Math.round(W * 0.52);
  const step = Math.round(H / 62);
  const cols = Math.ceil(w / step), rows = Math.ceil(H / step);
  const { data } = await sharp(avatar).resize(cols, rows, { fit: "cover" }).greyscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const ch = data.length / (cols * rows);
  let dots = "";
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = data[(y * cols + x) * ch] / 255;
    const r = (step / 2) * 1.05 * Math.pow(v, 0.9);
    if (r < 0.6) continue;
    const ox = y % 2 ? step / 2 : 0;
    dots += `<circle cx="${(x * step + ox + step / 2).toFixed(1)}" cy="${(y * step + step / 2).toFixed(1)}" r="${r.toFixed(1)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}"><defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.8"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="m"><rect width="${w}" height="${H}" fill="url(#l)"/></mask><filter id="g"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="${accent}" mask="url(#m)" filter="url(#g)">${dots}</g></svg>`;
  return [{ input: await sharp(Buffer.from(svg)).png().toBuffer(), left: 0, top: 0 }];
}

/** 4 · Shards: the picture sliced into slanted glass strips, pushed apart like a shattered print behind the ring. */
async function shards({ W, H, cx, cy, R, accent }: Geo, avatar: Buffer): Promise<Layer[]> {
  const G = Math.round(H * 1.05);
  const big = await sharp(avatar).resize(G, G, { fit: "cover" }).modulate({ brightness: 0.8, saturation: 1.3 }).ensureAlpha().png().toBuffer();
  const n = 7, slant = G * 0.28, sw = G / n;
  const out: Layer[] = [];
  const shift = [-0.05, 0.03, -0.08, 0.06, -0.03, 0.09, -0.06];
  for (let k = 0; k < n; k++) {
    const x0 = k * sw;
    const poly = `${x0 + slant},0 ${x0 + sw + slant},0 ${x0 + sw - slant},${G} ${x0 - slant},${G}`;
    const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${G}"><polygon points="${poly}" fill="#fff" fill-opacity="${0.55 + (k % 3) * 0.12}"/></svg>`;
    const edge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${G}"><polygon points="${poly}" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="3"/></svg>`);
    const piece = await sharp(await withMask(big, mask)).composite([{ input: edge }]).png().toBuffer();
    const l = await place(piece, cx + R * 0.35 - G / 2 + (k - n / 2) * R * 0.05, cy - G / 2 + shift[k] * G, W, H);
    if (l) out.push(l);
  }
  // keep the whole thing on the left (fade before the name)
  const flat = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(out).png().toBuffer();
  return [{ input: await withMask(flat, leftFade(W, H, 0.34, 0.47)), left: 0, top: 0 }];
}

/** 5 · Echo: a huge glowing duotone of the picture behind the ring (the first version). */
async function echo({ W, H, cx, cy, R, accent }: Geo, avatar: Buffer): Promise<Layer[]> {
  const tint = rgbOf(accent);
  const G = Math.round(H * 1.25);
  const { data: grey } = await sharp(avatar).resize(G, G, { fit: "cover" }).greyscale().normalise().blur(3).raw().toBuffer({ resolveWithObject: true });
  const ch = grey.length / (G * G);
  const px = Buffer.alloc(G * G * 4);
  for (let i = 0; i < G * G; i++) {
    const v = grey[i * ch] / 255, hi = Math.max(0, v - 0.9) * 1.2;
    px[i * 4] = Math.min(255, tint.r * v + 255 * hi);
    px[i * 4 + 1] = Math.min(255, tint.g * v + 255 * hi);
    px[i * 4 + 2] = Math.min(255, tint.b * v + 255 * hi);
    px[i * 4 + 3] = Math.round(Math.pow(v, 1.4) * 180);
  }
  const img = await sharp(px, { raw: { width: G, height: G, channels: 4 } }).png().toBuffer();
  const l = await place(img, cx + R * 0.75 - G / 2, cy - G / 2, W, H);
  if (!l) return [];
  const flat = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([l]).png().toBuffer();
  return [{ input: await withMask(flat, leftFade(W, H, 0.36, 0.5)), left: 0, top: 0 }];
}

/** The background layers for the chosen effect ([] for none, or when anything goes wrong — the banner is kept). */
export async function welcomeFxLayers(fx: string, geo: Geo, avatar: Buffer | null): Promise<Layer[]> {
  if (!avatar || fx === "none") return [];
  try {
    if (fx === "blur") return await blur(geo, avatar);
    if (fx === "cards") return await cards(geo, avatar);
    if (fx === "halftone") return await halftone(geo, avatar);
    if (fx === "shards") return await shards(geo, avatar);
    if (fx === "echo") return await echo(geo, avatar);
  } catch (e) {
    console.error("welcome fx failed (banner kept without it)", fx, e);
  }
  return [];
}
