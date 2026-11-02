import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { botInfo, botReady, dmUser, guildId, lastDmError } from "@/lib/discord-bot";

export const maxDuration = 300;

const Schema = z.object({
  mode: z.enum(["test", "all"]),
  content: z.string().trim().min(1).max(2000),
  title: z.string().trim().max(250).default(""),
  imageUrl: z.string().trim().max(600).default(""),
  linkUrl: z.string().trim().max(400).default(""),
  linkLabel: z.string().trim().max(80).default(""),
});

/** Admin: bot status + how many users linked Discord. */
export const GET = handle(async () => {
  await apiAdmin();
  const [linked, bot] = await Promise.all([db.user.count({ where: { banned: false, discordId: { not: null } } }), botInfo()]);
  const hist = await db.setting.findUnique({ where: { key: "discord_dm_history" } });
  return json({ ready: botReady(), bot, guild: !!guildId(), linked, history: hist ? JSON.parse(hist.value) : [] });
});

/** Admin: DM yourself (test) or every user who linked Discord. */
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const b = Schema.parse(await req.json());
  if (!botReady()) return json({ error: "bot_missing" }, 400);
  const msg = { content: b.content, title: b.title || undefined, imageUrl: /^https:\/\//.test(b.imageUrl) ? b.imageUrl : undefined, linkUrl: b.linkUrl || undefined, linkLabel: b.linkLabel || undefined };

  if (b.mode === "test") {
    const me = await db.user.findUnique({ where: { id: admin.id }, select: { discordId: true } });
    if (!me?.discordId) return json({ error: "admin_not_linked" }, 400);
    const r = await dmUser(me.discordId, msg);
    let inServer: boolean | null = null;
    const g = guildId();
    if (r !== "ok" && g) {
      const m = await fetch(`https://discord.com/api/v10/guilds/${g}/members/${me.discordId}`, { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!.trim().replace(/^Bot\s+/i, "")}` } }).catch(() => null);
      inServer = m ? m.ok : null;
    }
    return json({ sent: r === "ok" ? 1 : 0, closed: r === "closed" ? 1 : 0, failed: r === "error" ? 1 : 0, detail: r === "ok" ? "" : lastDmError, inServer });
  }

  const users = await db.user.findMany({ where: { banned: false, discordId: { not: null } }, select: { discordId: true } });
  let sent = 0, closed = 0, failed = 0;
  const started = Date.now();
  for (const u of users) {
    if (Date.now() - started > 280_000) break; // stay inside the time limit
    const r = await dmUser(u.discordId!, msg);
    if (r === "ok") sent++;
    else if (r === "closed") closed++;
    else failed++;
    await new Promise((r2) => setTimeout(r2, 350)); // gentle pace (Discord rate limits)
  }
  const hist = await db.setting.findUnique({ where: { key: "discord_dm_history" } });
  const list = [{ at: new Date().toISOString(), preview: b.content.slice(0, 80), sent, closed, failed, total: users.length }, ...(hist ? JSON.parse(hist.value) : [])].slice(0, 20);
  await db.setting.upsert({ where: { key: "discord_dm_history" }, create: { key: "discord_dm_history", value: JSON.stringify(list) }, update: { value: JSON.stringify(list) } });
  return json({ sent, closed, failed, total: users.length });
});
