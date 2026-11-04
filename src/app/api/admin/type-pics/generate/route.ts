import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { TYPE_PIC_KEYS, getTypePics } from "@/lib/type-pics";
import { loadBytes, saveFile } from "@/lib/storage";
import { posterCollage } from "@/lib/collage";
import { seriesInfo } from "@/lib/banners";

export const maxDuration = 60;

const Body = z.object({ key: z.enum(TYPE_PIC_KEYS) });

type Pic = { url: string };

/** Finished posters of a kind, newest first (no emails or names — just the pictures). */
async function posters(where: Record<string, unknown>, take = 30): Promise<{ url: string; design: unknown }[]> {
  const rows = await db.banner.findMany({
    where: { status: "READY", mode: "PRO", finalUrl: { not: null }, ...where },
    orderBy: { createdAt: "desc" },
    take,
    select: { finalUrl: true, design: true },
  });
  return rows.map((r) => ({ url: r.finalUrl!, design: r.design }));
}

/** Style thumbnails of a category, in display order. */
async function thumbs(layout: string): Promise<Pic[]> {
  const rows = await db.template.findMany({
    where: { active: true, deletedAt: null, thumbUrl: { not: null }, layout: layout as never },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    select: { thumbUrl: true },
    take: 12,
  });
  return rows.map((r) => ({ url: r.thumbUrl! }));
}

/** The pictures that belong to each box — its own category only. */
async function picturesFor(key: string): Promise<string[]> {
  let list: Pic[] = [];
  if (key === "ROSTER") {
    // Real roster banners (wide), then the roster style's own picture.
    list = await posters({ template: { slug: "player-roster-banner" } });
    if (list.length < 3) list = [...list, ...(await db.template.findMany({ where: { slug: "player-roster-banner", thumbUrl: { not: null } }, select: { thumbUrl: true } })).map((r) => ({ url: r.thumbUrl! }))];
  } else if (key === "TEAMSET") {
    // Cards that were made as a team set (same design, different players).
    const all = await posters({ template: { layout: "PLAYER" } }, 80);
    list = all.filter((p) => seriesInfo(p.design).seriesRootId);
  } else if (key === "SEASON") {
    // Posters made with a holiday / season theme.
    const all = await posters({}, 120);
    list = all.filter((p) => (p.design as { season?: unknown } | null)?.season);
  } else {
    // A normal category: its style pictures first, then real posters of that type.
    list = await thumbs(key);
    if (list.length < 3) list = [...list, ...(await posters({ template: { layout: key as never } }))];
  }
  const seen = new Set<string>();
  const urls = list.map((p) => p.url).filter((u) => u && !seen.has(u) && seen.add(u));
  // Spread the picks across the list so the cover shows variety.
  return urls.length <= 3 ? urls : [urls[0], urls[Math.floor(urls.length / 2)], urls[urls.length - 1]];
}

/** Admin: build the cover for a type box from that category's own pictures (a fanned "catalog" collage). */
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { key } = Body.parse(await req.json());
  const pick = await picturesFor(key);
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
