import sharp from "sharp";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";

export type StampSpot = "tl" | "tr" | "bl" | "br" | "tc" | "bc";

/**
 * Stamps the small KIXO mark on a finished poster where it covers the least — never over text or a face
 * when any calmer spot exists. Six spots are scored (four corners, bottom centre, top centre) by how much
 * crisp high-contrast detail they hold (text and faces score high, smooth backgrounds low); a smaller mark
 * is tried too, and a soft dark backdrop is added when every spot is busy. Returns the original bytes if
 * anything goes wrong — a missing mark must never cost the user their poster.
 */
export async function stampLogo(input: Buffer, avoid: StampSpot[] = []): Promise<Buffer> {
  try {
    const base = sharp(input);
    const { width: W = 0, height: H = 0 } = await base.metadata();
    if (!W || !H) return input;

    // Analysis copy: greyscale, 600 px wide — enough to see letters, cheap to scan.
    const aw = 600;
    const ah = Math.max(8, Math.round((H * aw) / W));
    const grey = await sharp(input).greyscale().resize(aw, ah, { fit: "fill" }).raw().toBuffer();
    const sx = aw / W;
    const sy = ah / H;
    /** How "busy" a poster region is (full-res coordinates): share of strong edges + luminance contrast. Text ≈ 25–60, plain backgrounds ≈ 0–8. */
    const busy = (left: number, top: number, w: number, h: number) => {
      const x0 = Math.max(1, Math.floor(left * sx));
      const y0 = Math.max(1, Math.floor(top * sy));
      const x1 = Math.min(aw - 1, Math.ceil((left + w) * sx));
      const y1 = Math.min(ah - 1, Math.ceil((top + h) * sy));
      let strong = 0;
      let n = 0;
      const vals: number[] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = grey[y * aw + x];
          const gx = v - grey[y * aw + x - 1];
          const gy = v - grey[(y - 1) * aw + x];
          if (Math.abs(gx) > 40 || Math.abs(gy) > 40) strong++;
          vals.push(v);
          n++;
        }
      }
      if (!n) return 0;
      vals.sort((a, b) => a - b);
      const contrast = (vals[Math.floor(n * 0.95)] - vals[Math.floor(n * 0.05)]) / 255;
      const edges = strong / n;
      // Letters: lots of crisp edges AND strong contrast at the same time.
      return edges * 100 + contrast * 20 + (edges > 0.1 && contrast > 0.45 ? 30 : 0);
    };

    const margin = Math.round(W * 0.03);
    const pad = 12;
    const sizes = [0.13, 0.1]; // normal, then smaller when everything is busy
    type Cand = { id: StampSpot; left: number; top: number; logoW: number; logoH: number; score: number };
    let best: Cand | null = null;
    const logoMeta = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).metadata();
    const ratio = (logoMeta.height ?? 1) / (logoMeta.width ?? 4);
    for (const [si, frac] of sizes.entries()) {
      const logoW = Math.round(W * frac);
      const logoH = Math.round(logoW * ratio);
      const spots: { id: StampSpot; left: number; top: number; pref: number }[] = [
        { id: "br", left: W - margin - logoW, top: H - margin - logoH, pref: 0 },
        { id: "bl", left: margin, top: H - margin - logoH, pref: 1 },
        { id: "bc", left: Math.round((W - logoW) / 2), top: H - margin - logoH, pref: 2 },
        { id: "tr", left: W - margin - logoW, top: margin, pref: 3 },
        { id: "tl", left: margin, top: margin, pref: 4 },
        { id: "tc", left: Math.round((W - logoW) / 2), top: margin, pref: 5 },
      ];
      for (const c of spots) {
        if (avoid.includes(c.id)) continue;
        const score = busy(c.left - pad, c.top - pad, logoW + pad * 2, logoH + pad * 2) + c.pref * 0.6 + si * 4;
        if (!best || score < best.score) best = { id: c.id, left: c.left, top: c.top, logoW, logoH, score };
      }
    }
    if (!best) return input;

    const logo = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).resize({ width: best.logoW }).png().toBuffer();
    const { height: logoH = best.logoH } = await sharp(logo).metadata();
    const logoW = best.logoW;

    // Shadow: the logo's silhouette in 55% black, blurred.
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

    const layers: { input: Buffer; left: number; top: number }[] = [];
    // Busy everywhere? A soft dark pill behind the mark keeps it readable without hiding much.
    if (best.score > 22) {
      const bp = Math.round(logoH * 0.45);
      const pill = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${logoW + bp * 2}" height="${logoH + bp * 2}"><rect x="${bp / 2}" y="${bp / 2}" width="${logoW + bp}" height="${logoH + bp}" rx="${Math.round((logoH + bp) / 2)}" fill="#000" fill-opacity="0.38"/></svg>`,
        ),
      )
        .blur(Math.max(2, bp / 3))
        .png()
        .toBuffer();
      layers.push({ input: pill, left: best.left - bp, top: best.top - bp });
    }
    layers.push({ input: shadow, left: best.left - pad + 2, top: best.top - pad + 3 });
    layers.push({ input: logo, left: best.left, top: best.top });
    const stamped = base.composite(layers.map((l) => ({ ...l, left: Math.max(0, l.left), top: Math.max(0, l.top) })));
    const png = await stamped.clone().png().toBuffer();
    // Keep files small enough to serve from a serverless function (~4.5 MB limit).
    if (png.length < 4.2 * 1024 * 1024) return png;
    return await stamped.jpeg({ quality: 96, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
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
      if (big) try {
        // Glossy 3D finish: a metallic sheen and a light top-left edge / dark bottom-right edge, clipped to the logo.
        const sheenSvg = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${lw}" height="${lh}"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
        );
        const sheen = await sharp(sheenSvg).composite([{ input: logo, blend: "dest-in" }]).png().toBuffer();
        const edge = Math.max(2, Math.round(lw * 0.008));
        const solid = await silhouette(0, 0, 0, 1);
        // Copy of the logo shape shifted down-right / up-left by `edge` px (same canvas size).
        const none = { r: 0, g: 0, b: 0, alpha: 0 };
        const shiftDR = await sharp(await sharp(solid).extend({ top: edge, left: edge, bottom: 0, right: 0, background: none }).png().toBuffer()).extract({ left: 0, top: 0, width: lw, height: lh }).png().toBuffer();
        const shiftUL = await sharp(await sharp(solid).extend({ top: 0, left: 0, bottom: edge, right: edge, background: none }).png().toBuffer()).extract({ left: edge, top: edge, width: lw, height: lh }).png().toBuffer();
        const rimLight = await sharp(await silhouette(255, 255, 255, 0.5)).composite([{ input: shiftDR, blend: "dest-out" }]).png().toBuffer();
        const rimDark = await sharp(await silhouette(0, 0, 0, 0.45)).composite([{ input: shiftUL, blend: "dest-out" }]).png().toBuffer();
        layers.push({ input: sheen, left, top });
        layers.push({ input: rimLight, left, top });
        layers.push({ input: rimDark, left, top });
      } catch (e) {
        console.error("logo finish failed (logo still placed)", e);
      }
    }
    // Keep every layer inside the canvas.
    const safe = layers.map((x) => ({ ...x, left: Math.max(0, x.left), top: Math.max(0, x.top) }));
    return await sharp(input).composite(safe).png().toBuffer();
  } catch (e) {
    console.error("placeLogos failed", e);
    return input;
  }
}
