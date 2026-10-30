import { db } from "./db";

export const SETTING_DEFAULTS = {
  signup_credits: "3",
  referral_reward: "20",
  pro_cost: "4",
  pro_quality: "high",
  max_upload_mb: "10",
  maintenance_message: "",
  discord_webhook: "",
  hero_1: "",
  hero_2: "",
  hero_3: "",
  hero_video: "",
  hero_video_opacity: "70",
  hero_bg_mode: "image",
  hero_effect: "stadium",
  sms_posters: "1",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.setting.findMany();
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
}

export async function getNumberSetting(key: SettingKey) {
  const s = await getSettings();
  const n = Number(s[key]);
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}
