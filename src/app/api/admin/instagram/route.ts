import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { fetchInstagram } from "@/lib/instagram";
import { db } from "@/lib/db";

export const maxDuration = 30;

/** Admin → Settings → Instagram: test the saved token (and warm the cache). */
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  z.object({ action: z.literal("test") }).parse(await req.json());
  const s = await getSettings();
  if (!s.instagram_token) return json({ error: "no_token" }, 400);
  try {
    const feed = await fetchInstagram(s.instagram_token, 9);
    await db.setting.upsert({ where: { key: "instagram_cache" }, create: { key: "instagram_cache", value: JSON.stringify({ at: Date.now(), ...feed }) }, update: { value: JSON.stringify({ at: Date.now(), ...feed }) } }).catch(() => {});
    await db.setting.upsert({ where: { key: "instagram_token_at" }, create: { key: "instagram_token_at", value: String(Date.now()) }, update: {} }).catch(() => {});
    return json({ ok: true, username: feed.username, count: feed.posts.length, thumbs: feed.posts.slice(0, 6).map((p) => p.image) });
  } catch (e) {
    return json({ error: "instagram", detail: (e instanceof Error ? e.message : String(e)).slice(0, 200) }, 400);
  }
});
