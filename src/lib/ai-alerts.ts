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
  fal_billing: "fal.ai account is LOCKED (TOP_UP) — the 4K mix (Nano Banana Pro art + FLUX.2 realism) is OFF, so every poster is made with OpenAI ONLY (clearly lower quality than your usual player cards) and AI videos fail — until you top up at fal.ai → Billing.",
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
        title: kind === "fal_billing" ? "⚠️ KIXO — posters lost the 4K mix" : "🚨 KIXO — posters are failing",
        content: kind === "fal_billing" ? text : `${text}\n\nUsers see "The AI is temporarily unavailable" and get their credits back automatically.`,
        linkUrl: `${site}/admin/logs`,
        linkLabel: "Open the live log",
      }).catch(() => {});
    }
  } catch {
    /* no bot configured */
  }
}

/** Remembers that posters are coming out of the OpenAI-only fallback (and why), so the admin overview can say so. */
export async function noteDegraded(reason: string) {
  const value = JSON.stringify({ at: new Date().toISOString(), reason: reason.slice(0, 300) });
  await db.setting.upsert({ where: { key: "ai_degraded" }, create: { key: "ai_degraded", value }, update: { value } }).catch(() => {});
}
export async function clearDegraded() {
  await db.setting.deleteMany({ where: { key: "ai_degraded" } }).catch(() => {});
}
/** The last fallback, if it happened in the past 6 hours. */
export async function degradedInfo(): Promise<{ at: string; reason: string } | null> {
  const row = await db.setting.findUnique({ where: { key: "ai_degraded" } }).catch(() => null);
  if (!row?.value) return null;
  try {
    const d = JSON.parse(row.value) as { at: string; reason: string };
    return Date.now() - new Date(d.at).getTime() < 6 * 60 * 60_000 ? d : null;
  } catch {
    return null;
  }
}
