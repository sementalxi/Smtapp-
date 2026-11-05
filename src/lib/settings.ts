import { cache } from "react";
import { db } from "./db";

export const SETTING_DEFAULTS = {
  signup_credits: "3",
  discord_bonus: "10",
  referral_reward: "20",
  pro_cost: "4",
  pro_quality: "high",
  max_upload_mb: "10",
  maintenance_message: "",
  discord_webhook: "",
  discord_server: "",
  notice_color: "#ff2e88",
  notice_effect: "none",
  hero_1: "",
  hero_2: "",
  hero_3: "",
  feat_1: "", // home "Next-level sports graphics" tiles (admin pictures; empty = style samples)
  feat_2: "",
  feat_3: "",
  feat_4: "",
  feat_5: "",
  feat_6: "",
  instagram_on: "off", // home Instagram section
  instagram_user: "",
  instagram_id: "", // Instagram account ID — only needed for Unified-login (EAA…) tokens
  instagram_token: "", // long-lived Instagram access token (Instagram API with Instagram Login)
  hero_video: "",
  hero_video_opacity: "70",
  hero_bg_mode: "image",
  hero_effect: "stadium",
  coming_soon: "0",
  vip_code: "", // secret part of the early-access link (/vip/<code>) that opens the full site during "coming soon"
  discord_link_role: "",
  site_title: "",
  site_description: "",
  share_image: "",
  support_role: "",
  support_on: "1",
  poster_model: "mix3",
  openai_only_layouts: "TOTW,STANDINGS",
  standings_exact_table: "on", // "on" = KIXO draws the standings table itself (real crests, exact names and numbers) on the AI background // poster types made by OpenAI GPT Image alone (no fal.ai steps), whatever the poster generator is
  video_on: "1",
  video_model: "kling-std",
  video_cost_5: "10",
  video_cost_10: "18",
  video_cost_audio: "5",
  daily_on: "1",
  daily_ladder: "1,2,3,4,5,6,10", // credits for day 1…7 of a streak (then it starts over)
  daily_epoch: "0", // bumped when the admin resets the daily reward for everyone
  style_test_sample: "", // JSON: the sample photo / crest / texts used by Admin → Style test
  daily_title: "Daily reward",
  daily_text: "Come back every day and claim your free credits. Keep your streak going!",
  daily_title_es: "Recompensa diaria",
  daily_text_es: "Vuelve cada día y reclama tus créditos gratis. ¡Mantén tu racha!",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Site settings — one small query per request (only the known keys, memoized per render). */
export const getSettings = cache(async (): Promise<Record<SettingKey, string>> => {
  const { memo } = await import("./memo");
  const rows = await memo<{ key: string; value: string }[]>("settings", 15_000, () => db.setting.findMany({ where: { key: { in: Object.keys(SETTING_DEFAULTS) } } }));
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
});

export async function getNumberSetting(key: SettingKey) {
  const s = await getSettings();
  const n = Number(s[key]);
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}
