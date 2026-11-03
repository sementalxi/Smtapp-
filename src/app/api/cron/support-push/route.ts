import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json } from "@/lib/api";
import { readTicket } from "@/lib/support";
import { pushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Every minute (Vercel cron): new staff replies in open tickets → phone notification to the user. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const ok = secret ? req.headers.get("authorization") === `Bearer ${secret}` : /vercel-cron/i.test(req.headers.get("user-agent") ?? "");
  if (!ok) return json({ error: "unauthorized" }, 401);
  const tickets = await db.supportTicket.findMany({ where: { status: "open" }, take: 50, orderBy: { updatedAt: "desc" } });
  let pushed = 0;
  for (const t of tickets) {
    if (!(await db.pushSub.count({ where: { userId: t.userId } }))) continue;
    const r = await readTicket(t).catch(() => undefined);
    if (!r) continue;
    const staff = r.messages.filter((m) => m.from === "staff");
    const last = staff[staff.length - 1];
    if (!last || last.id === t.lastStaffId) continue;
    // Only messages newer than the last one they saw / were told about.
    if (t.lastStaffId && BigInt(last.id) <= BigInt(t.lastStaffId)) continue;
    await db.supportTicket.update({ where: { id: t.id }, data: { lastStaffId: last.id } });
    pushed += await pushToUser(t.userId, {
      title: `💬 ${last.name} · KIXO Support`,
      body: (last.text || (last.images.length ? "📷 Sent a picture" : "New message")).slice(0, 180),
      url: "/?support=1",
      tag: `support-${t.id}`,
    });
  }
  // Also: fill in Discord pictures/handles for linked accounts that don't have them yet (a few per minute).
  const { syncDiscordProfile } = await import("@/lib/discord-bot");
  const todo = await db.user.findMany({ where: { discordId: { not: null }, discordUser: null }, select: { id: true, discordId: true }, take: 25 });
  let synced = 0;
  for (const u of todo) if (await syncDiscordProfile(u.id, u.discordId!).catch(() => false)) synced++;
  // Finish AI videos in the background.
  const videos = await import("@/lib/ai-video").then((m) => m.advanceAllVideos()).catch(() => 0);
  return json({ ok: true, tickets: tickets.length, pushed, synced, videos });
}
