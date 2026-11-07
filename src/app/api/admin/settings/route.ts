import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";

const Body = z.object({
  signup_credits: z.coerce.number().int().min(0).max(1000).optional(),
  discord_bonus: z.coerce.number().int().min(0).max(1000).optional(),
  referral_reward: z.coerce.number().int().min(0).max(10000).optional(),
  pro_cost: z.coerce.number().int().min(0).max(100).optional(),
  pro_quality: z.enum(["low", "medium", "high"]).optional(),
  max_upload_mb: z.coerce.number().int().min(1).max(50).optional(),
  maintenance_message: z.string().max(300).optional(),
  hero_1: z.string().max(500).optional(),
  hero_2: z.string().max(500).optional(),
  hero_3: z.string().max(500).optional(),
  feat_1: z.string().max(500).optional(),
  feat_2: z.string().max(500).optional(),
  feat_3: z.string().max(500).optional(),
  feat_4: z.string().max(500).optional(),
  feat_5: z.string().max(500).optional(),
  feat_6: z.string().max(500).optional(),
  instagram_on: z.enum(["on", "off"]).optional(),
  instagram_user: z.string().trim().max(40).regex(/^@?[A-Za-z0-9._]*$/).optional(),
  instagram_token: z.string().trim().max(1000).optional(),
  instagram_id: z.string().trim().max(30).regex(/^\d*$/).optional(),
  hero_video: z.string().trim().max(600).refine((u) => !u || /^https:\/\/\S+$/.test(u), "Use an https:// video link").optional(),
  hero_video_opacity: z.coerce.number().int().min(10).max(100).optional(),
  hero_effect: z.enum(["stadium", "smoke", "fire", "lightning", "rain", "speed", "grid", "stars", "aurora", "confetti", "none"]).optional(),
  hero_bg_mode: z.enum(["image", "video", "none"]).optional(),
  coming_soon: z.enum(["0", "1"]).optional(),
  site_title: z.string().trim().max(80).optional(),
  notice_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  notice_effect: z.enum(["none", "marquee", "glow", "shine", "blink"]).optional(),
  discord_server: z.string().trim().max(300).refine((u) => !u || /^https:\/\/(discord\.gg|discord\.com\/invite)\/\S+$/.test(u), "Use a discord.gg invite link").optional(),
  crest_modes: z.string().max(400).optional(),
  poster_model: z.enum(["mix", "mix3", "seedream-mix", "flux-mix", "flux", "nano-pro", "openai"]).optional(),
  openai_only_layouts: z.string().max(200).regex(/^[A-Z,]*$/).optional(),
  standings_exact_table: z.enum(["on", "off"]).optional(),
  qualifiers_exact_table: z.enum(["on", "off"]).optional(),
  winners_exact_grid: z.enum(["on", "off"]).optional(),
  welcome_ai_fx: z.enum(["none", "blur", "cards", "halftone", "shards", "mosaic", "honeycomb", "film", "duotone", "zoom", "rings", "echo"]).optional(),
  welcome_ai_daily: z.coerce.number().int().min(0).max(500).optional(),
  video_on: z.enum(["0", "1"]).optional(),
  video_model: z.enum(["kling-std", "kling-pro"]).optional(),
  video_cost_5: z.coerce.number().int().min(0).max(500).optional(),
  video_cost_10: z.coerce.number().int().min(0).max(1000).optional(),
  video_cost_audio: z.coerce.number().int().min(0).max(500).optional(),
  site_description: z.string().trim().max(300).optional(),
  daily_on: z.enum(["0", "1"]).optional(),
  daily_ladder: z.string().trim().regex(/^\d{1,4}(,\d{1,4}){6}$/, "7 numbers separated by commas").optional(),
  style_test_sample: z.string().max(8000).optional(),
  daily_title: z.string().trim().max(60).optional(),
  daily_text: z.string().trim().max(240).optional(),
  daily_title_es: z.string().trim().max(60).optional(),
  daily_text_es: z.string().trim().max(240).optional(),
  share_image: z.string().trim().max(500).optional(),
  discord_link_role: z.string().trim().regex(/^(\d{15,22})?$/).optional(),
  discord_admin_role: z.string().trim().regex(/^(\d{15,22})?$/).optional(),
  discord_staff_role: z.string().trim().regex(/^(\d{15,22})?$/).optional(),
  discord_support_role: z.string().trim().regex(/^(\d{15,22})?$/).optional(),
  discord_webhook: z
    .string()
    .trim()
    .max(300)
    .refine((u) => !u || /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(u), "Not a Discord webhook URL")
    .optional(),
});

export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin(); await (await import("@/lib/rev")).bumpRev();
  const body = Body.parse(await req.json());
  for (const k of ["hero_1", "hero_2", "hero_3", "share_image", "feat_1", "feat_2", "feat_3", "feat_4", "feat_5", "feat_6"] as const) if (body[k]) assertOwnUrl(body[k]);
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  return json({ ok: true });
});
