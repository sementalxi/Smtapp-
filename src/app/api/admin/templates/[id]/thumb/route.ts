import { NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { deleteFile, loadBytes, saveFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Admin: use a finished poster as a style's sample image (copied, so deleting the poster keeps the sample).
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const { bannerId } = z.object({ bannerId: z.string().max(40) }).parse(await req.json());
  const [tpl, banner] = await Promise.all([
    db.template.findUnique({ where: { id } }),
    db.banner.findUnique({ where: { id: bannerId }, select: { finalUrl: true } }),
  ]);
  if (!tpl) throw new HttpError(404, "template_not_found");
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  const small = await sharp(await loadBytes(banner.finalUrl))
    .resize({ width: 800, height: 1000, fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();
  const url = await saveFile("thumbs", small, "image/jpeg");
  await db.template.update({ where: { id }, data: { thumbUrl: url } });
  if (tpl.thumbUrl) await deleteFile(tpl.thumbUrl).catch(() => {});
  return json({ url });
});
