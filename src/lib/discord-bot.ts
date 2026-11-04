// Your own Discord bot: DMs users who linked Discord, and adds them to your server at sign-in.
// Needs DISCORD_BOT_TOKEN (and DISCORD_GUILD_ID for auto-join). Never logged or shown.
import { siteUrl } from "./email-template";

const API = "https://discord.com/api/v10";

export const botReady = () => !!process.env.DISCORD_BOT_TOKEN?.trim();
export const guildId = () => process.env.DISCORD_GUILD_ID?.trim() || "";
// Accepts the token with or without a "Bot " prefix or quotes around it.
const token = () => process.env.DISCORD_BOT_TOKEN!.trim().replace(/^["']|["']$/g, "").replace(/^Bot\s+/i, "").trim();
const auth = () => ({ Authorization: `Bot ${token()}`, "Content-Type": "application/json" });

async function call(path: string, init: RequestInit, tries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { ...auth(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000) });
    if (res.status !== 429 || i >= tries) return res;
    const wait = Number((await res.json().catch(() => ({})))?.retry_after ?? 1);
    await new Promise((r) => setTimeout(r, Math.min(10, wait) * 1000 + 100));
  }
}

/** Refreshes a user's Discord name, @handle and picture from Discord (bot token, no login needed). */
export async function syncDiscordProfile(userId: string, discordId: string): Promise<boolean> {
  if (!botReady()) return false;
  const r = await call(`/users/${discordId}`, { method: "GET" }).catch(() => null);
  if (!r?.ok) return false;
  const d = (await r.json()) as { id: string; username?: string; global_name?: string | null; avatar?: string | null };
  const { db } = await import("./db");
  await db.user.update({
    where: { id: userId },
    data: {
      discordName: (d.global_name || d.username || "").slice(0, 60) || null,
      discordUser: (d.username || "").slice(0, 40) || null,
      discordAvatar: d.avatar ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${d.avatar.startsWith("a_") ? "gif" : "png"}?size=256` : null,
    },
  });
  return true;
}

/** Raw bot API call (for other modules). */
export const botCall = (path: string, init: RequestInit) => call(path, init);

/** The bot's own name (to check the token works). */
export async function botInfo(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!botReady()) return { ok: false, error: "missing" };
  const res = await call("/users/@me", { method: "GET" }).catch(() => null);
  if (!res) return { ok: false, error: "network" };
  if (!res.ok) return { ok: false, error: res.status === 401 ? "bad_token" : `http_${res.status}` };
  const d = await res.json();
  return { ok: true, name: d.username };
}

export type DmMessage = { content: string; title?: string; imageUrls?: string[]; linkUrl?: string; linkLabel?: string };

export let lastDmError = "";

/** Sends a DM. Returns "ok", "closed" (DMs off / no shared server) or "error". */
export async function dmUser(discordId: string, m: DmMessage): Promise<"ok" | "closed" | "error"> {
  lastDmError = "";
  const ch = await call("/users/@me/channels", { method: "POST", body: JSON.stringify({ recipient_id: discordId }) }).catch(() => null);
  if (!ch?.ok) {
    const e = ch ? await ch.json().catch(() => ({})) : {};
    lastDmError = `${ch?.status ?? "net"} ${e.code ?? ""} ${e.message ?? ""}`.trim();
    return "error";
  }
  const { id } = await ch.json();
  const site = siteUrl();
  const abs = (u: string) => (u.startsWith("/") ? `${site}${u}` : u);
  const imgs = (m.imageUrls ?? []).map(abs).filter((u) => /^https:\/\//.test(u)).slice(0, 4);
  // A branded card: logo + name on top, the message inside, images as a gallery, footer + time.
  const main = {
    author: { name: "KIXO", icon_url: `${site}/kixo-logo.png`, url: site },
    title: m.title?.slice(0, 250) || undefined,
    url: site, // same url on every embed = Discord shows the images as one gallery
    description: m.content.slice(0, 4000),
    color: 0xff2e88,
    image: imgs[0] ? { url: imgs[0] } : undefined,
    footer: { text: "kixo.pro · AI sports posters", icon_url: `${site}/kixo-logo.png` },
    timestamp: new Date().toISOString(),
  };
  const embeds = [main, ...imgs.slice(1).map((u) => ({ url: site, image: { url: u } }))];
  const buttons = [
    ...(m.linkUrl && /^https:\/\//.test(m.linkUrl) ? [{ type: 2, style: 5, label: (m.linkLabel || "Open KIXO").slice(0, 80), url: m.linkUrl, emoji: { name: "🔥" } }] : []),
    { type: 2, style: 5, label: "kixo.pro", url: site, emoji: { name: "🌐" } },
  ];
  const components = [{ type: 1, components: buttons }];
  const res = await call(`/channels/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds, components, allowed_mentions: { parse: [] } }),
  }).catch(() => null);
  if (!res) return "error";
  if (res.ok) return "ok";
  const e = await res.json().catch(() => ({}));
  lastDmError = `${res.status} ${e.code ?? ""} ${e.message ?? ""}`.trim();
  return res.status === 403 ? "closed" : "error";
}

/** Adds the user to your server (needs the "guilds.join" scope on their sign-in). */
export async function addToGuild(discordId: string, userAccessToken: string) {
  const g = guildId();
  if (!botReady() || !g) return;
  await call(`/guilds/${g}/members/${discordId}`, { method: "PUT", body: JSON.stringify({ access_token: userAccessToken }) }).catch(() => null);
  await giveLinkRole(discordId).catch(() => {});
}

/** Gives the "linked their KIXO account" role (Admin → Settings → Discord role). Needs Manage Roles, bot role above it. */
export async function giveLinkRole(discordId: string): Promise<{ ok: boolean; error?: string }> {
  const g = guildId();
  if (!botReady() || !g) return { ok: false, error: "missing" };
  const { getSettings } = await import("./settings");
  const role = (await getSettings()).discord_link_role?.trim();
  if (!role) return { ok: false, error: "no_role" };
  const r = await call(`/guilds/${g}/members/${discordId}/roles/${role}`, { method: "PUT" }).catch(() => null);
  if (r?.ok) return { ok: true };
  return { ok: false, error: r?.status === 403 ? "no_permission" : r?.status === 404 ? "not_in_server" : `http_${r?.status ?? "net"}` };
}

/** Roles in your server (for the admin picker). */
export async function listRoles(): Promise<{ id: string; name: string }[]> {
  const g = guildId();
  if (!botReady() || !g) return [];
  const r = await call(`/guilds/${g}/roles`, { method: "GET" }).catch(() => null);
  if (!r?.ok) return [];
  const all = (await r.json()) as { id: string; name: string; managed: boolean; position: number }[];
  return all.filter((x) => x.id !== g && !x.managed).sort((a, b) => b.position - a.position).map((x) => ({ id: x.id, name: x.name }));
}

/** Creates a private "KIXO LOGS" category with one channel + webhook per log kind. Needs Manage Channels + Manage Webhooks. */
export async function createLogChannels(channels: readonly { key: string; channel: string }[]): Promise<{ ok: boolean; hooks?: Record<string, string>; error?: string }> {
  const g = guildId();
  if (!botReady() || !g) return { ok: false, error: "missing" };
  const list = await call(`/guilds/${g}/channels`, { method: "GET" }).catch(() => null);
  if (list && !list.ok) return { ok: false, error: list.status === 401 ? "bad_token" : list.status === 403 || list.status === 404 ? "not_in_server" : `http_${list.status}` };
  const existing = list ? ((await list.json()) as { id: string; name: string; type: number; parent_id?: string }[]) : [];
  let parent = existing.find((c) => c.type === 4 && /kixo logs/i.test(c.name))?.id;
  if (!parent) {
    const cat = await call(`/guilds/${g}/channels`, {
      method: "POST",
      // type 4 = category; hidden from @everyone (role id = guild id)
      body: JSON.stringify({ name: "📊 KIXO LOGS", type: 4, permission_overwrites: [{ id: g, type: 0, deny: "1024" }] }),
    }).catch(() => null);
    if (!cat?.ok) return { ok: false, error: cat?.status === 403 ? "no_permission" : `http_${cat?.status ?? "net"}` };
    parent = (await cat.json()).id as string;
  }
  const hooks: Record<string, string> = {};
  for (const c of channels) {
    let id = existing.find((x) => x.type === 0 && x.parent_id === parent && x.name === c.channel)?.id;
    if (!id) {
      const ch = await call(`/guilds/${g}/channels`, { method: "POST", body: JSON.stringify({ name: c.channel, type: 0, parent_id: parent }) }).catch(() => null);
      if (!ch?.ok) return { ok: false, error: ch?.status === 403 ? "no_permission" : `http_${ch?.status ?? "net"}`, hooks };
      id = (await ch.json()).id as string;
    }
    const wh = await call(`/channels/${id}/webhooks`, { method: "POST", body: JSON.stringify({ name: "KIXO Log" }) }).catch(() => null);
    if (!wh?.ok) return { ok: false, error: wh?.status === 403 ? "no_webhook_permission" : `http_${wh?.status ?? "net"}`, hooks };
    const w = await wh.json();
    hooks[c.key] = `https://discord.com/api/webhooks/${w.id}/${w.token}`;
  }
  return { ok: true, hooks };
}

/** Makes a webhook in an existing channel (for the public showcase). Needs Manage Webhooks. */
export async function createWebhookIn(channelId: string): Promise<{ url?: string; error?: string }> {
  if (!botReady()) return { error: "missing" };
  const r = await call(`/channels/${channelId}/webhooks`, { method: "POST", body: JSON.stringify({ name: "KIXO Showcase" }) }).catch(() => null);
  if (!r?.ok) return { error: r?.status === 403 ? "no_webhook_permission" : r?.status === 404 ? "no_channel" : `http_${r?.status ?? "net"}` };
  const w = await r.json();
  return { url: `https://discord.com/api/webhooks/${w.id}/${w.token}` };
}

/** Every channel in the server, with its type (0 text, 4 category) and parent. */
export async function listAllChannels(): Promise<{ id: string; name: string; type: number; parent_id?: string | null }[]> {
  const g = guildId();
  if (!botReady() || !g) return [];
  const r = await call(`/guilds/${g}/channels`, { method: "GET" }).catch(() => null);
  if (!r?.ok) return [];
  return (await r.json()) as { id: string; name: string; type: number; parent_id?: string | null }[];
}

/** Makes a public text channel (optionally inside a category). Needs Manage Channels. */
export async function createTextChannel(name: string, parentId?: string | null, topic?: string): Promise<{ id?: string; error?: string }> {
  const g = guildId();
  if (!botReady() || !g) return { error: "missing" };
  const r = await call(`/guilds/${g}/channels`, { method: "POST", body: JSON.stringify({ name, type: 0, ...(parentId ? { parent_id: parentId } : {}), ...(topic ? { topic } : {}) }) }).catch(() => null);
  if (!r?.ok) return { error: r?.status === 403 ? "no_permission" : `http_${r?.status ?? "net"}` };
  return { id: (await r.json()).id as string };
}

/** Makes a category (public). */
export async function createCategory(name: string): Promise<{ id?: string; error?: string }> {
  const g = guildId();
  if (!botReady() || !g) return { error: "missing" };
  const r = await call(`/guilds/${g}/channels`, { method: "POST", body: JSON.stringify({ name, type: 4 }) }).catch(() => null);
  if (!r?.ok) return { error: r?.status === 403 ? "no_permission" : `http_${r?.status ?? "net"}` };
  return { id: (await r.json()).id as string };
}

/** Text channels in your server (id + name). */
export async function listTextChannels(): Promise<{ id: string; name: string }[]> {
  const g = guildId();
  if (!botReady() || !g) return [];
  const r = await call(`/guilds/${g}/channels`, { method: "GET" }).catch(() => null);
  if (!r?.ok) return [];
  const all = (await r.json()) as { id: string; name: string; type: number }[];
  return all.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, name: c.name }));
}
