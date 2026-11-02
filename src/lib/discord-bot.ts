// Your own Discord bot: DMs users who linked Discord, and adds them to your server at sign-in.
// Needs DISCORD_BOT_TOKEN (and DISCORD_GUILD_ID for auto-join). Never logged or shown.
const API = "https://discord.com/api/v10";

export const botReady = () => !!process.env.DISCORD_BOT_TOKEN?.trim();
export const guildId = () => process.env.DISCORD_GUILD_ID?.trim() || "";
const auth = () => ({ Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!.trim()}`, "Content-Type": "application/json" });

async function call(path: string, init: RequestInit, tries = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { ...auth(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10000) });
    if (res.status !== 429 || i >= tries) return res;
    const wait = Number((await res.json().catch(() => ({})))?.retry_after ?? 1);
    await new Promise((r) => setTimeout(r, Math.min(10, wait) * 1000 + 100));
  }
}

/** The bot's own name (to check the token works). */
export async function botInfo(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!botReady()) return { ok: false, error: "missing" };
  const res = await call("/users/@me", { method: "GET" }).catch(() => null);
  if (!res) return { ok: false, error: "network" };
  if (!res.ok) return { ok: false, error: res.status === 401 ? "bad_token" : `http_${res.status}` };
  const d = await res.json();
  return { ok: true, name: d.username };
}

export type DmMessage = { content: string; title?: string; imageUrl?: string; linkUrl?: string; linkLabel?: string };

/** Sends a DM. Returns "ok", "closed" (DMs off / no shared server) or "error". */
export async function dmUser(discordId: string, m: DmMessage): Promise<"ok" | "closed" | "error"> {
  const ch = await call("/users/@me/channels", { method: "POST", body: JSON.stringify({ recipient_id: discordId }) }).catch(() => null);
  if (!ch?.ok) return "error";
  const { id } = await ch.json();
  const embed =
    m.title || m.imageUrl
      ? [{ title: m.title?.slice(0, 250), url: m.linkUrl || undefined, color: 0xff2e88, image: m.imageUrl ? { url: m.imageUrl } : undefined }]
      : undefined;
  const components =
    m.linkUrl && /^https:\/\//.test(m.linkUrl)
      ? [{ type: 1, components: [{ type: 2, style: 5, label: (m.linkLabel || "Open KIXO").slice(0, 80), url: m.linkUrl }] }]
      : undefined;
  const res = await call(`/channels/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: m.content.slice(0, 2000), embeds: embed, components, allowed_mentions: { parse: [] } }),
  }).catch(() => null);
  if (!res) return "error";
  if (res.ok) return "ok";
  return res.status === 403 ? "closed" : "error";
}

/** Adds the user to your server (needs the "guilds.join" scope on their sign-in). */
export async function addToGuild(discordId: string, userAccessToken: string) {
  const g = guildId();
  if (!botReady() || !g) return;
  await call(`/guilds/${g}/members/${discordId}`, { method: "PUT", body: JSON.stringify({ access_token: userAccessToken }) }).catch(() => null);
}
