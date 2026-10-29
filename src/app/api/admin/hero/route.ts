import { NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadBytes, saveFile } from "@/lib/storage";

// Admin: put a finished poster on the home page (slot 1–3). The image is copied.
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { bannerId, slot } = z.object({ bannerId: z.string().max(40), slot: z.number().int().min(1).max(3) }).parse(await req.json());
  const banner = await db.banner.findUnique({ where: { id: bannerId }, select: { finalUrl: true } });
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  const small = await sharp(await loadBytes(banner.finalUrl)).resize({ width: 900, height: 1125, fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
  const url = await saveFile("thumbs", small, "image/jpeg");
  const key = `hero_${slot}`;
  await db.setting.upsert({ where: { key }, create: { key, value: url }, update: { value: url } });
  return json({ url });
});
