// Live support: the website user chats in a pop-up; each ticket is a private channel in your Discord server
// ("🎫 KIXO SUPPORT" category). Staff simply reply in that channel and the user sees it live on the website.
import { db } from "./db";
import { botReady, guildId, botCall } from "./discord-bot";
import { getSettings } from "./settings";
import { appUrl } from "./stripe";

export type ChatMsg = { id: string; from: "me" | "staff" | "system"; name: string; avatar?: string; text: string; images: string[]; at: string };

const CATEGORY = "🎫 KIXO SUPPORT";
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "user";

export const supportReady = () => botReady() && !!guildId();

async function supportCategory(g: string): Promise<string> {
  const list = await botCall(`/guilds/${g}/channels`, { method: "GET" });
  if (!list.ok) throw new Error(list.status === 403 ? "no_permission" : `http_${list.status}`);
  const chans = (await list.json()) as { id: string; name: string; type: number }[];
  const found = chans.find((c) => c.type === 4 && c.name === CATEGORY);
  const role = (await getSettings()).support_role?.trim();
  if (found) {
    // Keep the staff role on the category (in case it was picked after the category was made).
    if (role) await botCall(`/channels/${found.id}/permissions/${role}`, { method: "PUT", body: JSON.stringify({ type: 0, allow: "117760" }) }).catch(() => null);
    return found.id;
  }
  const me = (await (await botCall("/users/@me", { method: "GET" })).json()) as { id: string };
  const cat = await botCall(`/guilds/${g}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: CATEGORY,
      type: 4,
      permission_overwrites: [
        { id: g, type: 0, deny: "1024" }, // @everyone can't see
        { id: me.id, type: 1, allow: "536988688" }, // bot: view, send, history, embeds, files, manage webhooks + channels
        ...(role ? [{ id: role, type: 0, allow: "117760" }] : []), // staff: view, send, history, files
      ],
    }),
  });
  if (!cat.ok) throw new Error(cat.status === 403 ? "no_permission" : `http_${cat.status}`);
  return ((await cat.json()) as { id: string }).id;
}

export async function openTicket(userId: string) {
  const existing = await db.supportTicket.findFirst({ where: { userId, status: "open" }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  const g = guildId();
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, credits: true, discordId: true, planId: true } });
  if (!u) throw new Error("no_user");
  const parent = await supportCategory(g);
  const ch = await botCall(`/guilds/${g}/channels`, { method: "POST", body: JSON.stringify({ name: `ticket-${slug(u.name)}`, type: 0, parent_id: parent, topic: `KIXO website support · ${u.email}` }) });
  if (!ch.ok) throw new Error(ch.status === 403 ? "no_permission" : `http_${ch.status}`);
  const channelId = ((await ch.json()) as { id: string }).id;
  const wh = await botCall(`/channels/${channelId}/webhooks`, { method: "POST", body: JSON.stringify({ name: "KIXO Support" }) });
  if (!wh.ok) throw new Error(wh.status === 403 ? "no_webhook_permission" : `http_${wh.status}`);
  const w = (await wh.json()) as { id: string; token: string };
  const role = (await getSettings()).support_role?.trim();
  await botCall(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: role ? `<@&${role}> new website ticket` : undefined,
      allowed_mentions: { roles: role ? [role] : [] },
      embeds: [
        {
          title: `🎫 Support ticket — ${u.name}`,
          description: "Reply in this channel — the user sees your messages live on kixo.pro.\nTap **🔒 End chat** (or type **!close**) to end it.",
          color: 0xff2e88,
          fields: [
            { name: "Email", value: u.email.slice(0, 200), inline: true },
            { name: "Credits", value: `⚡ ${u.credits}`, inline: true },
            { name: "Plan", value: u.planId || "—", inline: true },
            ...(u.discordId ? [{ name: "Discord", value: `<@${u.discordId}>`, inline: true }] : []),
            { name: "Admin", value: `${appUrl()}/admin/users/${userId}` },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      components: [{ type: 1, components: [{ type: 2, style: 4, custom_id: `kxsupport:close:${channelId}`, label: "End chat", emoji: { name: "🔒" } }] }],
    }),
  });
  return db.supportTicket.create({ data: { userId, channelId, webhookUrl: `https://discord.com/api/webhooks/${w.id}/${w.token}` } });
}

/** Posts the user's message into the ticket channel (shown with their name). */
export async function sendFromUser(ticket: { webhookUrl: string }, user: { name: string }, text: string, imageUrl?: string) {
  const res = await fetch(`${ticket.webhookUrl}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `${user.name.replace(/discord|clyde/gi, "").slice(0, 70) || "User"} (website)`,
      content: text.slice(0, 1900) || undefined,
      embeds: imageUrl ? [{ image: { url: imageUrl }, color: 0xff2e88 }] : undefined,
      allowed_mentions: { parse: [] },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return "gone";
  return res.ok ? "ok" : "error";
}

/** Messages in the ticket, oldest first. Returns null if the channel was deleted. */
export async function readTicket(ticket: { channelId: string; webhookUrl: string }): Promise<{ messages: ChatMsg[]; closed: boolean } | null> {
  const r = await botCall(`/channels/${ticket.channelId}/messages?limit=100`, { method: "GET" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`http_${r.status}`);
  const hookId = ticket.webhookUrl.split("/webhooks/")[1]?.split("/")[0];
  const raw = (await r.json()) as {
    id: string; content: string; timestamp: string; webhook_id?: string;
    author: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
    attachments?: { url: string; content_type?: string }[]; embeds?: { image?: { url: string }; title?: string; description?: string }[];
  }[];
  let closed = false;
  const out: ChatMsg[] = [];
  for (const m of raw.reverse()) {
    const images = [...(m.attachments ?? []).filter((a) => (a.content_type ?? "").startsWith("image/")).map((a) => a.url), ...(m.embeds ?? []).map((e) => e.image?.url).filter((x): x is string => !!x)];
    if (m.webhook_id && m.webhook_id === hookId) {
      out.push({ id: m.id, from: "me", name: "", text: m.content, images, at: m.timestamp });
      continue;
    }
    if (m.author.bot) {
      // "🔒 Chat ended by …" from the End chat button (or the website) closes the ticket.
      if ((m.embeds ?? []).some((e) => /^🔒/.test(e.description ?? ""))) { closed = true; out.push({ id: m.id, from: "system", name: "", text: "closed", images: [], at: m.timestamp }); }
      continue; // the intro card and other bot messages
    }
    if (/^!close\b/i.test(m.content.trim())) { closed = true; out.push({ id: m.id, from: "system", name: "", text: "closed", images: [], at: m.timestamp }); continue; }
    out.push({
      id: m.id,
      from: "staff",
      name: m.author.global_name || m.author.username,
      avatar: m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : undefined,
      text: m.content,
      images,
      at: m.timestamp,
    });
  }
  return { messages: out, closed };
}

export async function closeTicket(ticket: { id: string; channelId: string }, by: string) {
  await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "closed" } });
  await botCall(`/channels/${ticket.channelId}/messages`, { method: "POST", body: JSON.stringify({ embeds: [{ description: `🔒 Ticket closed by ${by}. This channel is deleted automatically in 24 hours.`, color: 0x8a7d8c }] }) }).catch(() => null);
  const name = await botCall(`/channels/${ticket.channelId}`, { method: "GET" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (name?.name && !String(name.name).startsWith("closed-")) await botCall(`/channels/${ticket.channelId}`, { method: "PATCH", body: JSON.stringify({ name: `closed-${String(name.name).replace(/^ticket-/, "")}`.slice(0, 90) }) }).catch(() => null);
}
