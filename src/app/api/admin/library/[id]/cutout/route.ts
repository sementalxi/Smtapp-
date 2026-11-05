import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { canRemoveBackground } from "@/lib/ai";
import { loadBytes, saveFile, sniffImage } from "@/lib/storage";
import { cutoutLogo } from "@/lib/cutout";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 60;

/** Admin → Library: turn a logo into a transparent PNG — solid backgrounds instantly, others with the AI remover. */
export const POST = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const item = await db.libraryItem.findUnique({ where: { id } });
  if (!item?.logoUrl) throw new HttpError(404, "no_logo");
  const bytes = await loadBytes(item.logoUrl);
  const { png, method } = await cutoutLogo(bytes, sniffImage(bytes) ?? "image/png");
  if (method === "none") return json({ error: canRemoveBackground() ? "failed" : "not_configured", detail: canRemoveBackground() ? "the background could not be separated" : undefined }, 400);
  if (method === "alpha") return json({ ok: true, url: item.logoUrl, already: true });
  const url = await saveFile("logos", png, "image/png");
  await db.libraryItem.update({ where: { id }, data: { logoUrl: url } });
  return json({ ok: true, url, method });
});
