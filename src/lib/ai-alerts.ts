// When an AI provider stops working for money reasons (OpenAI out of credits, fal.ai locked), every poster fails.
// Users get a calm "temporarily unavailable" message; admins get a Discord DM + a red line in the live log (once an hour).
import { db } from "./db";
import { logActivity } from "./activity";

export type Outage = "openai_billing" | "fal_billing" | "openai_down";

/** Recognises provider-side outages in an error message. */
export function providerOutage(msg: string): Outage | null {
  if (/credit_balance_exhausted|insufficient_quota|billing_hard_limit|exceeded your current quota/i.test(msg)) return "openai_billing";
  if (/TOP_UP|User is locked/i.test(msg)) return "fal_billing";
  if (/OpenAI image failed: 5\d\d|server_error|overloaded/i.test(msg)) return "openai_down";
  return null;
}

export const OUTAGE_TEXT: Record<Outage, string> = {
  openai_billing: "OpenAI account has NO CREDITS left — every poster fails until you top up at platform.openai.com → Settings → Billing.",
  fal_billing: "fal.ai account is LOCKED (TOP_UP) — Nano Banana / FLUX / videos fail until you top up at fal.ai → Billing.",
  openai_down: "OpenAI is returning server errors — posters are failing; usually passes in a few minutes.",
};

/** Alerts every admin with a linked Discord (at most once per hour per kind) and writes a red line in the live log. */
export async function alertAdminsOutage(kind: Outage, raw: string) {
  const key = `ai_alert_${kind}`;
  const last = await db.setting.findUnique({ where: { key } }).catch(() => null);
  if (last && Date.now() - new Date(last.value).getTime() < 60 * 60_000) return;
  await db.setting.upsert({ where: { key }, create: { key, value: new Date().toISOString() }, update: { value: new Date().toISOString() } }).catch(() => {});
  const text = OUTAGE_TEXT[kind];
  await logActivity("site", "ai_outage", `🚨 ${text} (${raw.slice(0, 160)})`, "error").catch(() => {});
  try {
    const { dmUser } = await import("./discord-bot");
    const admins = await db.user.findMany({ where: { role: "ADMIN", discordId: { not: null } }, select: { discordId: true } });
    const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
    for (const a of admins) {
      if (!a.discordId) continue;
      await dmUser(a.discordId, {
        title: "🚨 KIXO — posters are failing",
        content: `${text}\n\nUsers see "The AI is temporarily unavailable" and get their credits back automatically.`,
        linkUrl: `${site}/admin/logs`,
        linkLabel: "Open the live log",
      }).catch(() => {});
    }
  } catch {
    /* no bot configured */
  }
}
