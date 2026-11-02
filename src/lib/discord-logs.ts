// Discord logs, each kind in its own channel: sign-ups, purchases, subscriptions and one per flyer type.
// Webhook URLs are stored in the "discord_log_hooks" setting; anything not set falls back to the main webhook.
import { db } from "./db";
import { discordWebhook, postToDiscord } from "./discord";
import { appUrl } from "./stripe";

export const LOG_CHANNELS = [
  { key: "signups", channel: "new-accounts", label: "🆕 New accounts", labelEs: "🆕 Cuentas nuevas" },
  { key: "purchases", channel: "purchases", label: "💳 Purchases", labelEs: "💳 Compras" },
  { key: "subscriptions", channel: "subscriptions", label: "⭐ Subscriptions", labelEs: "⭐ Suscripciones" },
  { key: "PLAYER", channel: "player-cards", label: "🧍 Player cards", labelEs: "🧍 Tarjetas de jugador" },
  { key: "CHAMPIONS", channel: "champions", label: "🏆 Champions", labelEs: "🏆 Campeones" },
  { key: "MATCHDAY", channel: "match-day", label: "📅 Match day", labelEs: "📅 Día de partido" },
  { key: "LINEUP", channel: "lineups", label: "📋 Lineups", labelEs: "📋 Alineaciones" },
  { key: "RESULT", channel: "results", label: "⚽ Results", labelEs: "⚽ Resultados" },
  { key: "EVENT", channel: "tournaments", label: "🎟️ Tournaments / events", labelEs: "🎟️ Torneos / eventos" },
] as const;
export type LogKey = (typeof LOG_CHANNELS)[number]["key"];

const HOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//;

export async function getLogHooks(): Promise<Partial<Record<LogKey, string>>> {
  const s = await db.setting.findUnique({ where: { key: "discord_log_hooks" } }).catch(() => null);
  try {
    const o = s ? JSON.parse(s.value) : {};
    return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && HOOK_RE.test(v as string))) as Partial<Record<LogKey, string>>;
  } catch {
    return {};
  }
}
export async function saveLogHooks(h: Partial<Record<LogKey, string>>) {
  const clean = Object.fromEntries(Object.entries(h).filter(([, v]) => v && HOOK_RE.test(v)));
  await db.setting.upsert({ where: { key: "discord_log_hooks" }, create: { key: "discord_log_hooks", value: JSON.stringify(clean) }, update: { value: JSON.stringify(clean) } });
}
/** The webhook for this kind of log (its own channel, or the main one). */
export async function hookFor(key: LogKey | string) {
  const h = await getLogHooks();
  return (h as Record<string, string>)[key] || (await discordWebhook());
}

const money = (cents: number, cur = "usd") => `${cur === "usd" ? "$" : ""}${(cents / 100).toFixed(2)}${cur === "usd" ? "" : ` ${cur.toUpperCase()}`}`;

/** 🆕 New account. Never throws. */
export async function logSignup(userId: string, via: "email" | "discord") {
  try {
    const url = await hookFor("signups");
    if (!url) return;
    const [u, total] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, credits: true, referredById: true, phone: true } }),
      db.user.count(),
    ]);
    if (!u) return;
    const ref = u.referredById ? await db.user.findUnique({ where: { id: u.referredById }, select: { name: true } }) : null;
    await postToDiscord(
      {
        username: "KIXO · New accounts",
        embeds: [
          {
            title: `🆕 ${u.name}`,
            url: `${appUrl()}/admin/users/${userId}`,
            color: 0x2fd8e8,
            fields: [
              { name: "Email", value: u.email.slice(0, 200), inline: true },
              { name: "Signed up with", value: via === "discord" ? "Discord" : "Email", inline: true },
              { name: "Welcome credits", value: `⚡ ${u.credits}`, inline: true },
              ...(ref ? [{ name: "Invited by", value: ref.name.slice(0, 100), inline: true }] : []),
              { name: "Total users", value: String(total), inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      undefined,
      url,
    );
  } catch (e) {
    console.error("discord signup log failed", e);
  }
}

/** 💳 Purchase or ⭐ subscription payment. Never throws. */
export async function logPayment(p: { userId: string; kind: "pack" | "deal" | "subscription"; productId: string; amountCents: number; credits: number; source: string; currency?: string; renewal?: boolean }) {
  try {
    const sub = p.kind === "subscription";
    const url = await hookFor(sub ? "subscriptions" : "purchases");
    if (!url) return;
    const [u, revenue] = await Promise.all([
      db.user.findUnique({ where: { id: p.userId }, select: { name: true, email: true, credits: true } }),
      db.payment.aggregate({ _sum: { amountCents: true } }),
    ]);
    await postToDiscord(
      {
        username: sub ? "KIXO · Subscriptions" : "KIXO · Purchases",
        embeds: [
          {
            title: sub ? `⭐ ${p.renewal ? "Subscription renewed" : "New subscription"} — ${money(p.amountCents, p.currency)}` : `💳 ${money(p.amountCents, p.currency)} — ${p.productId}`,
            url: `${appUrl()}/admin/users/${p.userId}`,
            color: sub ? 0xffc83d : 0x3ddc84,
            fields: [
              { name: "User", value: `${u?.name ?? "?"}\n${u?.email ?? ""}`.slice(0, 500), inline: true },
              { name: sub ? "Plan" : "Product", value: `${p.productId}${p.kind === "deal" ? " (deal)" : ""}`.slice(0, 200), inline: true },
              { name: "Credits", value: `+${p.credits} (now ⚡ ${u?.credits ?? "?"})`, inline: true },
              { name: "Paid with", value: p.source, inline: true },
              { name: "Total revenue", value: money(revenue._sum.amountCents ?? 0), inline: true },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      undefined,
      url,
    );
  } catch (e) {
    console.error("discord payment log failed", e);
  }
}

/** Test message to one channel (from the admin page). */
export async function testLog(key: LogKey) {
  const url = await hookFor(key);
  if (!url) return false;
  const c = LOG_CHANNELS.find((x) => x.key === key);
  return postToDiscord({ username: "KIXO Log", embeds: [{ title: `✅ ${c?.label ?? key} — test`, description: "Logs for this kind will show up here.", color: 0xff2e88, timestamp: new Date().toISOString() }] }, undefined, url);
}
