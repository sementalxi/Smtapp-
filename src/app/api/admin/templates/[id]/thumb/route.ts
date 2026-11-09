import { NextRequest } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { deleteFile, loadBytes, saveFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// Admin: use a finished poster as a style's sample image (copied, so deleting the poster keeps the sample).
// With `ref: true` the poster becomes the style's REFERENCE image instead — the look every new poster of the
// style is matched to (the sample image stays as it is).
export const POST = handle(async (req: NextRequest, { params }: Ctx) => {
  await apiAdmin(); await (await import("@/lib/rev")).bumpRev();
  const { id } = await params;
  const { bannerId, ref } = z.object({ bannerId: z.string().max(40), ref: z.boolean().optional() }).parse(await req.json());
  const [tpl, banner] = await Promise.all([
    db.template.findUnique({ where: { id } }),
    db.banner.findUnique({ where: { id: bannerId }, select: { finalUrl: true, templateId: true } }),
  ]);
  if (!tpl) throw new HttpError(404, "template_not_found");
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  if (ref) {
    // The old reference file is kept: built-in references and copied styles may still point at it.
    // A poster made with this very style is filed as the style's own (its brief keeps deciding the colours).
    const refUrl = await (await import("@/lib/style-ref")).posterAsStyleRef(await loadBytes(banner.finalUrl), banner.templateId === id);
    await db.template.update({ where: { id }, data: { styleRefUrl: refUrl } });
    return json({ url: refUrl });
  }
  const small = await sharp(await loadBytes(banner.finalUrl))
    .resize({ width: 800, height: 1000, fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();
  const url = await saveFile("thumbs", small, "image/jpeg");
  await db.template.update({ where: { id }, data: { thumbUrl: url } });
  if (tpl.thumbUrl) await deleteFile(tpl.thumbUrl).catch(() => {});
  return json({ url });
});
