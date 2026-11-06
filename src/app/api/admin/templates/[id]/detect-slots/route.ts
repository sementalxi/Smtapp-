import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { detectSlotsFromImage } from "@/lib/detect-slots";
import { parseSlotOverrides, textSlotsFor } from "@/lib/text-slots";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin (from the creator): read this style's reference flyer, create one box per text line and SAVE them on
 * the style right away — the built-in boxes and the admin's edits to them are kept, earlier auto-created
 * boxes are replaced. Returns the boxes the creator should now show.
 */
export const POST = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const t = await db.template.findUnique({ where: { id }, select: { slug: true, styleRefUrl: true, textSlots: true } });
  if (!t) throw new HttpError(404, "not_found");
  if (!t.styleRefUrl) throw new HttpError(400, "no_style_ref");
  const found = await detectSlotsFromImage(t.styleRefUrl);
  const kept = parseSlotOverrides(t.textSlots).filter((o) => !o.custom);
  const merged = [...kept, ...found.filter((f) => !kept.some((k) => k.key === f.key))];
  const jsonText = JSON.stringify(merged);
  await db.template.update({ where: { id }, data: { textSlots: jsonText } });
  await (await import("@/lib/rev")).bumpRev();
  return json({ slots: textSlotsFor(t.slug, jsonText), json: jsonText, added: found.length });
});
