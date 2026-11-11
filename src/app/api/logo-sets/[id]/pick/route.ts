import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadBytes, saveFile } from "@/lib/storage";
import { publicSet, type LogoInputs, type LogoOption } from "@/lib/logo-maker";

export const maxDuration = 60;
const Body = z.object({ index: z.number().int().min(0).max(4) });

/** The player picks one option: it is unlocked in full size, plus a transparent PNG, and saved to their posters. */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const { index } = Body.parse(await req.json());
  const set = await db.logoSet.findFirst({ where: { id, userId: user.id } });
  if (!set) throw new HttpError(404, "not_found");
  if (set.picked >= 0) return json({ set: publicSet(set) }); // one pick per set
  const opt = ((Array.isArray(set.options) ? set.options : []) as LogoOption[])[index];
  if (!opt) throw new HttpError(400, "not_ready");
  const full = await loadBytes(opt.full);
  // transparent version (the logo is made on a flat dark background, so it cuts out cleanly)
  let pngUrl = "";
  try {
    const { cutoutLogo } = await import("@/lib/cutout");
    const r = await cutoutLogo(full, "image/png", 1024, false);
    if (r.method !== "none") pngUrl = await saveFile("logos", r.png, "image/png");
  } catch (e) {
    console.error("logo pick: cutout failed", e);
  }
  // saved to "My posters" like any other poster (when the logo style exists)
  let bannerId = "";
  try {
    const tpl = await db.template.findFirst({ where: { layout: "LOGO", deletedAt: null, proInstructions: { contains: "[LOGO CREATE]" } }, select: { id: true } });
    if (tpl) {
      const inp = set.inputs as unknown as LogoInputs;
      const b = await db.banner.create({
        data: { userId: user.id, templateId: tpl.id, status: "READY", mode: "PRO", title: inp.name, inputs: { team: inp.name, subtitle: inp.idea } as never, design: { logoSet: set.id } as never, finalUrl: opt.full, logoUrl: pngUrl || null },
      });
      bannerId = b.id;
    }
  } catch (e) {
    console.error("logo pick: banner save failed", e);
  }
  const upd = await db.logoSet.update({ where: { id }, data: { picked: index, pickedUrl: opt.full, pngUrl, bannerId } });
  return json({ set: publicSet(upd), bannerId });
});
