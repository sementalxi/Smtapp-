import sharp from "sharp";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";

/**
 * Stamps the KIXO logo small in the bottom-right corner of a poster, with a soft
 * shadow so it reads on light and dark designs. Returns the original bytes if
 * anything goes wrong — a missing logo must never cost the user their poster.
 */
export async function stampLogo(input: Buffer): Promise<Buffer> {
  try {
    const base = sharp(input);
    const { width: W = 0, height: H = 0 } = await base.metadata();
    if (!W || !H) return input;

    const logoW = Math.round(W * 0.13);
    const logo = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).resize({ width: logoW }).png().toBuffer();
    const { height: logoH = 0 } = await sharp(logo).metadata();

    // Shadow: the logo's silhouette in 55% black, blurred.
    const pad = 12;
    const shadow = await sharp({
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
      .blur(5)
      .png()
      .toBuffer();

    const margin = Math.round(W * 0.03);
    // Put the logo in the calmest corner (least detail), so it never covers faces or text.
    const corners = [
      { left: W - margin - logoW, top: H - margin - logoH }, // bottom-right (preferred on ties)
      { left: margin, top: H - margin - logoH }, // bottom-left
      { left: W - margin - logoW, top: margin }, // top-right
      { left: margin, top: margin }, // top-left
    ];
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
