import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";

const Body = z.object({
  signup_credits: z.coerce.number().int().min(0).max(1000).optional(),
  referral_reward: z.coerce.number().int().min(0).max(10000).optional(),
  pro_cost: z.coerce.number().int().min(0).max(100).optional(),
  pro_quality: z.enum(["low", "medium", "high"]).optional(),
  max_upload_mb: z.coerce.number().int().min(1).max(50).optional(),
  maintenance_message: z.string().max(300).optional(),
  hero_1: z.string().max(500).optional(),
  hero_2: z.string().max(500).optional(),
  hero_3: z.string().max(500).optional(),
  hero_video: z.string().trim().max(600).refine((u) => !u || /^https:\/\/\S+$/.test(u), "Use an https:// video link").optional(),
  hero_video_opacity: z.coerce.number().int().min(10).max(100).optional(),
  hero_bg_mode: z.enum(["image", "video", "none"]).optional(),
  discord_webhook: z
    .string()
    .trim()
    .max(300)
    .refine((u) => !u || /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(u), "Not a Discord webhook URL")
    .optional(),
});

export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Body.parse(await req.json());
  for (const k of ["hero_1", "hero_2", "hero_3"] as const) if (body[k]) assertOwnUrl(body[k]);
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  return json({ ok: true });
});
