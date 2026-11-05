import { NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { saveFile } from "@/lib/storage";

export const maxDuration = 120;

const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

/**
 * Admin test: a FAITHFUL 2× upscale (Real-ESRGAN — it enlarges and sharpens, it does not redraw) of a finished poster.
 * Saved as a separate file next to the original, so both can be compared; the original is never touched.
 */
export const POST = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  if (!process.env.FAL_KEY?.trim()) throw new HttpError(400, "fal_not_configured");
  const { id } = await params;
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  const src = banner.finalUrl.startsWith("/") ? site() + banner.finalUrl : banner.finalUrl;

  const r = await fetch("https://fal.run/fal-ai/esrgan", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: src, scale: 2, model: "RealESRGAN_x4plus", face: false, output_format: "png" }),
    signal: AbortSignal.timeout(100_000),
  });
  const d = (await r.json().catch(() => ({}))) as { image?: { url?: string }; images?: { url?: string }[]; detail?: unknown };
  const out = d.image?.url ?? d.images?.[0]?.url;
  if (!r.ok || !out) return json({ error: "upscale_failed", detail: `${r.status} ${JSON.stringify(d.detail ?? d).slice(0, 200)}` }, 502);
  const img = await fetch(out, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) return json({ error: "upscale_failed", detail: `download ${img.status}` }, 502);
  // Top-quality JPEG so a ~13 MP poster stays phone-friendly.
  const buf = await sharp(Buffer.from(await img.arrayBuffer())).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toBuffer();
  const meta = await sharp(buf).metadata();
  const url = await saveFile("banners", buf, "image/jpeg");
  const design = (banner.design ?? {}) as Record<string, unknown>;
  await db.banner.update({ where: { id }, data: { design: { ...design, upscaledUrl: url } as never } });
  return json({ url, width: meta.width, height: meta.height });
});
