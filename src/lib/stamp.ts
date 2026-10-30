import sharp from "sharp";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";

/**
 * Stamps the KIXO logo small in the bottom-right corner of a poster, with a soft
 * shadow so it reads on light and dark designs. Returns the original bytes if
 * anything goes wrong — a missing logo must never cost the user their poster.
 */
export async function stampLogo(input: Buffer, avoid: ("tl" | "tr" | "bl" | "br")[] = []): Promise<Buffer> {
  try {
    const base = sharp(input);
    const { width: W = 0, height: H = 0 } = await base.metadata();
    if (!W || !H) return input;

    const logoW = Math.round(W * 0.13);
    const logo = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).resize({ width: logoW }).png().toBuffer();
    const { height: logoH = 0 } = await sharp(logo).metadata();

    // Shadow: the logo's silhouette in 55% black, blurred.
    const pad = 12;
    const shadowBase = await sharp({
      create: { width: logoW + pad * 2, height: logoH + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp({ create: { width: logoW, height: logoH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.55 } } })
            .composite([{ input: logo, blend: "dest-in" }])
            .png()
            .toBuffer(),
          left: pad,
          top: pad,
        },
      ])
      .png()
      .toBuffer();
    const shadow = await sharp(shadowBase).blur(5).png().toBuffer();

    const margin = Math.round(W * 0.03);
    // Put the logo in the calmest corner (least detail), so it never covers faces or text.
    const corners = [
      { id: "br", left: W - margin - logoW, top: H - margin - logoH }, // bottom-right (preferred on ties)
      { id: "bl", left: margin, top: H - margin - logoH }, // bottom-left
      { id: "tr", left: W - margin - logoW, top: margin }, // top-right
      { id: "tl", left: margin, top: margin }, // top-left
    ].filter((c) => !avoid.includes(c.id as "tl"));
    let best = corners[0];
    let bestScore = Infinity;
    for (const [n, c] of corners.entries()) {
      try {
        const region = await sharp(input)
          .extract({ left: Math.max(0, c.left - pad), top: Math.max(0, c.top - pad), width: Math.min(logoW + pad * 2, W), height: Math.min(logoH + pad * 2, H) })
          .greyscale()
          .resize(64, 16, { fit: "fill" })
          .raw()
          .toBuffer();
        // Busy-ness = average difference between neighbouring pixels.
        let diff = 0;
        for (let k = 1; k < region.length; k++) diff += Math.abs(region[k] - region[k - 1]);
        const score = diff / region.length + n * 0.5; // slight preference order
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      } catch {
        /* skip this corner */
      }
    }
    const { left, top } = best;
    const stamped = base.composite([
      { input: shadow, left: left - pad + 2, top: top - pad + 3 },
      { input: logo, left, top },
    ]);
    const png = await stamped.clone().png().toBuffer();
    // Keep files small enough to serve from a serverless function (~4.5 MB limit).
    if (png.length < 3.5 * 1024 * 1024) return png;
    return await stamped.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  } catch (e) {
    console.error("stampLogo failed", e);
    return input;
  }
}

/**
 * Pastes the user's real team logo(s) onto the finished poster exactly as uploaded:
 * small in a top corner, big as the hero (champions), or left/right of the VS (match day / result).
 * A coloured glow plus a soft shadow makes it look lit into the scene rather than stuck on.
 */
export async function placeLogos(input: Buffer, logos: { bytes: Buffer; corner: "tl" | "tr" | "hero" | "left" | "right" }[]): Promise<Buffer> {
  try {
    const { width: W = 0, height: H = 0 } = await sharp(input).metadata();
    if (!W || !H) return input;
    const layers: { input: Buffer; left: number; top: number }[] = [];
    for (const l of logos) {
      const spot = {
        tl: { size: 0.22, cx: 0.04 + 0.11, cy: null as number | null },
        tr: { size: 0.22, cx: 1 - 0.04 - 0.11, cy: null as number | null },
        hero: { size: 0.44, cx: 0.5, cy: 0.62 },
        left: { size: 0.3, cx: 0.25, cy: 0.4 },
        right: { size: 0.3, cx: 0.75, cy: 0.4 },
      }[l.corner];
      const box = Math.round(W * spot.size);
      const logo = await sharp(l.bytes)
        .rotate()
        .trim({ threshold: 12 })
        .resize({ width: box, height: box, fit: "inside" })
        .ensureAlpha()
        .png()
        .toBuffer()
        .catch(() => sharp(l.bytes).resize({ width: box, height: box, fit: "inside" }).ensureAlpha().png().toBuffer());
      const { width: lw = box, height: lh = box } = await sharp(logo).metadata();
      const big = l.corner === "hero" || l.corner === "left" || l.corner === "right";
      const pad = Math.round(box * (big ? 0.35 : 0.18));
      const silhouette = (r: number, g: number, b: number, a: number) =>
        sharp({ create: { width: lw, height: lh, channels: 4, background: { r, g, b, alpha: a } } })
          .composite([{ input: logo, blend: "dest-in" }])
          .png()
          .toBuffer();
      const blurred = async (sil: Buffer, blur: number) =>
        sharp(
          await sharp({ create: { width: lw + pad * 2, height: lh + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite([{ input: sil, left: pad, top: pad }])
            .png()
            .toBuffer(),
        )
          .blur(Math.max(3, blur))
          .png()
          .toBuffer();
      const left = Math.round(W * spot.cx - lw / 2);
      const top = spot.cy === null ? Math.round(W * 0.04 + (box - lh) / 2) : Math.round(H * spot.cy - lh / 2);
      // 1) dark shadow for contrast, 2) warm light glow so it sits "in" the light, 3) the logo itself.
      if (big) {
        // Bright halo: an enlarged, blurred light-coloured silhouette, stacked for strength.
        const grow = Math.round(lw * 0.12);
        const bigSil = await sharp(await silhouette(255, 240, 200, 0.75)).resize({ width: lw + grow * 2, height: lh + grow * 2, fit: "fill" }).png().toBuffer();
        const halo = await sharp(
          await sharp({ create: { width: lw + pad * 2, height: lh + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .composite([{ input: bigSil, left: pad - grow, top: pad - grow }])
            .png()
            .toBuffer(),
        )
          .blur(Math.max(4, pad / 3.5))
          .png()
          .toBuffer();
        layers.push({ input: halo, left: left - pad, top: top - pad });
        layers.push({ input: halo, left: left - pad, top: top - pad });
        layers.push({ input: await blurred(await silhouette(0, 0, 0, 0.6), pad / 8), left: left - pad, top: top - pad + 6 });
      } else {
        layers.push({ input: await blurred(await silhouette(0, 0, 0, 0.8), pad / 2.5), left: left - pad, top: top - pad + Math.round(pad * 0.12) });
      }
      layers.push({ input: logo, left, top });
    }
    // Keep every layer inside the canvas.
    const safe = layers.map((x) => ({ ...x, left: Math.max(0, x.left), top: Math.max(0, x.top) }));
    return await sharp(input).composite(safe).png().toBuffer();
  } catch (e) {
    console.error("placeLogos failed", e);
    return input;
  }
}
