import { NextRequest } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { canRemoveBackground, removeBackground } from "@/lib/ai";
import { loadBytes, saveFile, sniffImage } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 60;

/** Admin → Library: turn a logo into a transparent PNG (background removed) — it then floats on the home page. */
export const POST = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const item = await db.libraryItem.findUnique({ where: { id } });
  if (!item?.logoUrl) throw new HttpError(404, "no_logo");
  if (!canRemoveBackground()) return json({ error: "not_configured" }, 400);
  const bytes = await loadBytes(item.logoUrl);
  const type = sniffImage(bytes) ?? "image/png";
  let png: Buffer;
  try {
    png = await removeBackground(bytes, type);
  } catch (e) {
    return json({ error: "failed", detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) }, 502);
  }
  // Trim the empty margins so the logo fills its tile.
  const trimmed = await sharp(png).trim({ threshold: 8 }).png().toBuffer().catch(() => png);
  const url = await saveFile("logos", trimmed, "image/png");
  await db.libraryItem.update({ where: { id }, data: { logoUrl: url } });
  return json({ ok: true, url });
});
