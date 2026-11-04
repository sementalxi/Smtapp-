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
  hero_video: "",
  hero_video_opacity: "70",
  hero_bg_mode: "image",
  hero_effect: "stadium",
  coming_soon: "0",
  discord_link_role: "",
  site_title: "",
  site_description: "",
  share_image: "",
  support_role: "",
  support_on: "1",
  poster_model: "mix3",
  totw_model: "openai", // team of the week: "openai" = OpenAI GPT Image only (no fal.ai), "same" = the poster generator above
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
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(SETTING_DEFAULTS) } } });
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
});

export async function getNumberSetting(key: SettingKey) {
  const s = await getSettings();
  const n = Number(s[key]);
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}
