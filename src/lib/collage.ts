import sharp from "sharp";

/**
 * A "catalog" cover: up to 3 posters fanned out over a dark branded backdrop
 * (used for the pictures behind the type boxes on the Create page).
 */
export async function posterCollage(posters: Buffer[], opts: { width?: number; height?: number } = {}): Promise<Buffer> {
  const W = opts.width ?? 1400;
  const H = opts.height ?? 875;
  const pics = posters.slice(0, 3);
  if (!pics.length) throw new Error("no_posters");

  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a0f1d"/><stop offset="1" stop-color="#0d090f"/></linearGradient>
      <radialGradient id="p" cx="0.75" cy="0.2" r="0.6"><stop offset="0" stop-color="#ff2e88" stop-opacity="0.35"/><stop offset="1" stop-color="#ff2e88" stop-opacity="0"/></radialGradient>
      <radialGradient id="t" cx="0.15" cy="0.9" r="0.6"><stop offset="0" stop-color="#2fd8e8" stop-opacity="0.22"/><stop offset="1" stop-color="#2fd8e8" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#p)"/>
    <rect width="${W}" height="${H}" fill="url(#t)"/>
  </svg>`);

  // Each picture keeps its own shape (tall poster, square logo, wide banner).
  const metas = await Promise.all(pics.map((b) => sharp(b).metadata().catch(() => ({ width: 4, height: 5 }))));
  const ratios = metas.map((m) => Math.min(1.9, Math.max(0.55, (m.width ?? 4) / (m.height ?? 5))));
  const wideMode = ratios.filter((r) => r > 1.2).length >= Math.ceil(pics.length / 2);
  // Poster sizes: side ones a bit smaller and tilted, the middle one biggest and straight.
  const mainH = Math.round(H * (wideMode ? 0.5 : 0.86));
  const sideH = Math.round(H * (wideMode ? 0.44 : 0.72));
  const rounded = async (buf: Buffer, h: number, ratio: number) => {
    const w = Math.round(h * ratio);
    const img = await sharp(buf).resize({ width: w, height: h, fit: "cover" }).png().toBuffer();
    const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${Math.round(h * 0.03)}" fill="#fff"/></svg>`);
    // Rounded corners + a thin light edge.
    const edge = Buffer.from(`<svg width="${w}" height="${h}"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.round(h * 0.03)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/></svg>`);
    return sharp(img).composite([{ input: mask, blend: "dest-in" }, { input: edge }]).png().toBuffer();
  };
  const shadowOf = async (w: number, h: number) =>
    sharp(Buffer.from(`<svg width="${w + 80}" height="${h + 80}"><rect x="40" y="52" width="${w}" height="${h}" rx="18" fill="rgba(0,0,0,0.65)"/></svg>`)).blur(18).png().toBuffer();

  const layers: { input: Buffer; left: number; top: number }[] = [];
  const order = pics.length === 1 ? [["c", 0]] : pics.length === 2 ? [["l", 0], ["r", 1]] : [["l", 1], ["r", 2], ["c", 0]];
  for (const [slot, idx] of order as ["l" | "r" | "c", number][]) {
    const h = slot === "c" ? mainH : sideH;
    const w = Math.round(h * ratios[idx]);
    const card = await rounded(pics[idx], h, ratios[idx]);
    const angle = wideMode ? (slot === "l" ? -4 : slot === "r" ? 4 : 2) : slot === "l" ? -9 : slot === "r" ? 9 : 0;
    const tilted = angle ? await sharp(card).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() : card;
    const meta = await sharp(tilted).metadata();
    const tw = meta.width ?? w;
    const th = meta.height ?? h;
    // Wide banners stack diagonally (top-left, bottom-right, big one in the middle); posters fan out side by side.
    const cx = wideMode ? (slot === "l" ? W * 0.36 : slot === "r" ? W * 0.64 : W * 0.5) : slot === "l" ? W * 0.28 : slot === "r" ? W * 0.72 : W * 0.5;
    const cy = wideMode ? (slot === "l" ? H * 0.28 : slot === "r" ? H * 0.74 : H * 0.5) : slot === "c" ? H * 0.52 : H * 0.55;
    const left = Math.round(cx - tw / 2);
    const top = Math.round(cy - th / 2);
    const sh = await shadowOf(tw, th);
    layers.push({ input: sh, left: left - 40, top: top - 40 });
    layers.push({ input: tilted, left, top });
  }
  return sharp(bg).composite(layers).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
