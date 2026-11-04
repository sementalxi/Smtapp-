import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { TYPE_PIC_KEYS, getTypePics } from "@/lib/type-pics";
import { loadBytes, saveFile } from "@/lib/storage";
import { posterCollage } from "@/lib/collage";

export const maxDuration = 60;

const Body = z.object({ key: z.enum(TYPE_PIC_KEYS) });

/** Admin: build the cover for a type box from that category's own style pictures (a fanned "catalog" collage). */
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { key } = Body.parse(await req.json());
  // Which posters to use for each box.
  const layout = key === "ROSTER" || key === "TEAMSET" ? "PLAYER" : key === "SEASON" ? null : key;
  const rows = await db.template.findMany({
    where: { active: true, deletedAt: null, thumbUrl: { not: null }, ...(layout ? { layout: layout as never } : {}) },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    select: { thumbUrl: true, slug: true },
    take: 12,
  });
  let urls = rows.map((r) => r.thumbUrl!).filter(Boolean);
  if (key === "ROSTER") {
    const roster = rows.find((r) => r.slug === "player-roster-banner");
    if (roster?.thumbUrl) urls = [roster.thumbUrl, ...urls.filter((u) => u !== roster.thumbUrl)];
  }
  if (key === "SEASON") {
    // A mix: one from each of the first few categories.
    const seen = new Set<string>();
    const mixed = await db.template.findMany({ where: { active: true, deletedAt: null, thumbUrl: { not: null } }, orderBy: [{ sort: "asc" }], select: { thumbUrl: true, layout: true }, take: 60 });
    urls = mixed.filter((m) => !seen.has(m.layout) && seen.add(m.layout)).map((m) => m.thumbUrl!);
  }
  // Spread the picks across the category instead of taking the first three.
  const pick = urls.length <= 3 ? urls : [urls[0], urls[Math.floor(urls.length / 2)], urls[urls.length - 1]];
  if (!pick.length) return json({ error: "no_pictures" }, 400);
  const buffers: Buffer[] = [];
  for (const u of pick) {
    try {
      buffers.push(await loadBytes(u));
    } catch {
      /* skip a broken picture */
    }
  }
  if (!buffers.length) return json({ error: "no_pictures" }, 400);
  const out = await posterCollage(buffers);
  const url = await saveFile("thumbs", out, "image/jpeg");
  const pics = { ...(await getTypePics()), [key]: url };
  const value = JSON.stringify(pics);
  await db.setting.upsert({ where: { key: "type_pics" }, create: { key: "type_pics", value }, update: { value } });
  return json({ url, used: buffers.length });
});
