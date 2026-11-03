// Welcome DM: the bot messages people when they sign up with Discord or connect Discord to their account.
// The admin writes it in Admin → Discord → Welcome message.
import { db } from "./db";
import { dmUser, botReady } from "./discord-bot";

export type WelcomeDm = { on: boolean; title: string; content: string; imageUrls: string[]; linkUrl: string; linkLabel: string };
export const WELCOME_DEFAULT: WelcomeDm = {
  on: false,
  title: "Welcome to KIXO, {name}! 🔥",
  content: "Your account is ready and you have **⚡ {credits} credits** to start.\n\nMake pro player cards, match day posters, lineups and more in seconds.\n\n¡Bienvenido! Tu cuenta está lista.",
  imageUrls: [],
  linkUrl: "https://kixo.pro/create",
  linkLabel: "Create my first poster",
};

export async function getWelcomeDm(): Promise<WelcomeDm> {
  const row = await db.setting.findUnique({ where: { key: "welcome_dm" } }).catch(() => null);
  try {
    return { ...WELCOME_DEFAULT, ...(row ? JSON.parse(row.value) : {}) };
  } catch {
    return WELCOME_DEFAULT;
  }
}
export async function saveWelcomeDm(w: WelcomeDm) {
  const value = JSON.stringify(w);
  await db.setting.upsert({ where: { key: "welcome_dm" }, create: { key: "welcome_dm", value }, update: { value } });
}

const fill = (s: string, u: { name: string; credits: number; discordName?: string | null }) =>
  s.replaceAll("{name}", u.name).replaceAll("{credits}", String(u.credits)).replaceAll("{discord}", u.discordName || u.name);

/** Sends the welcome DM to this user (once per account unless force). Never throws. */
export async function sendWelcomeDm(userId: string, opts: { force?: boolean; preview?: WelcomeDm } = {}): Promise<"ok" | "off" | "sent_before" | "no_discord" | "closed" | "error"> {
  try {
    const w = opts.preview ?? (await getWelcomeDm());
    if (!w.on && !opts.force) return "off";
    if (!botReady()) return "error";
    const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, credits: true, discordId: true, discordName: true } });
    if (!u?.discordId) return "no_discord";
    const flag = `welcome_dm_sent:${userId}`;
    if (!opts.force && (await db.setting.findUnique({ where: { key: flag } }).catch(() => null))) return "sent_before";
    const r = await dmUser(u.discordId, {
      title: fill(w.title, u).slice(0, 250),
      content: fill(w.content, u).slice(0, 4000) || " ",
      imageUrls: w.imageUrls,
      linkUrl: w.linkUrl,
      linkLabel: fill(w.linkLabel, u),
    });
    if (r === "ok" && !opts.force) await db.setting.create({ data: { key: flag, value: new Date().toISOString() } }).catch(() => {});
    return r;
  } catch (e) {
    console.error("welcome dm failed", e);
    return "error";
  }
}
