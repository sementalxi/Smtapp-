// Instagram feed for the home page (Instagram API with Instagram Login): the admin pastes a long-lived token in
// Settings; the latest posts are cached in a Setting row and refreshed every few hours; the token (60 days) is
// renewed by the cron before it expires.
import { db } from "./db";
import { getSettings } from "./settings";

export type IgPost = { id: string; url: string; image: string; caption: string; type: string; at: string };

const API = "https://graph.instagram.com";
const CACHE_KEY = "instagram_cache";
const CACHE_MS = 6 * 60 * 60_000;
const REFRESH_EVERY_MS = 20 * 24 * 60 * 60_000;

async function setting(key: string) {
  return (await db.setting.findUnique({ where: { key } }).catch(() => null))?.value ?? "";
}
async function put(key: string, value: string) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } }).catch(() => {});
}

const FB = "https://graph.facebook.com/v21.0";
/** Instagram Login tokens start with "IG"; Unified-login / system-user tokens ("EAA…") go through the Facebook Graph API. */
export const isIgLoginToken = (token: string) => /^IG/.test(token.trim());

async function getJson(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `Instagram ${r.status}`);
  return j;
}

/** Unified login: find the Instagram professional account behind the token (its pages, or the ID saved in Settings). */
async function fbIgAccount(token: string, savedId: string): Promise<{ id: string; username: string }> {
  const t = encodeURIComponent(token);
  if (/^\d{5,}$/.test(savedId)) {
    const j = await getJson(`${FB}/${savedId}?fields=id,username&access_token=${t}`);
    return { id: String(j.id ?? savedId), username: String(j.username ?? "") };
  }
  const pages = (await getJson(`${FB}/me/accounts?fields=instagram_business_account{id,username}&limit=50&access_token=${t}`).catch(() => ({ data: [] }))) as { data?: { instagram_business_account?: { id: string; username?: string } }[] };
  const ig = (pages.data ?? []).map((p) => p.instagram_business_account).find(Boolean);
  if (ig) return { id: ig.id, username: ig.username ?? "" };
  throw new Error("Unified-login token: paste your Instagram account ID (the number under your username in the Meta app) in the “Instagram account ID” box");
}

/** The account's latest posts (images; videos use their thumbnail). Throws with a readable reason. */
export async function fetchInstagram(token: string, limit = 9, savedId = ""): Promise<{ username: string; posts: IgPost[] }> {
  token = token.trim();
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  if (!isIgLoginToken(token)) {
    const acct = await fbIgAccount(token, savedId.trim());
    const j = (await getJson(`${FB}/${acct.id}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`)) as { data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string }[] };
    const posts = (j.data ?? [])
      .map((m) => ({ id: m.id, url: m.permalink, image: m.media_type === "VIDEO" ? m.thumbnail_url ?? "" : m.media_url ?? "", caption: (m.caption ?? "").slice(0, 160), type: m.media_type, at: m.timestamp }))
      .filter((p) => p.image);
    return { username: acct.username, posts };
  }
  const me = await fetch(`${API}/me?fields=id,username&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(12_000) });
  const meJson = (await me.json().catch(() => ({}))) as { username?: string; error?: { message?: string } };
  if (!me.ok) throw new Error(meJson.error?.message ?? `Instagram ${me.status}`);
  const r = await fetch(`${API}/me/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15_000) });
  const j = (await r.json().catch(() => ({}))) as { data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `Instagram ${r.status}`);
  const posts = (j.data ?? [])
    .map((m) => ({ id: m.id, url: m.permalink, image: m.media_type === "VIDEO" ? m.thumbnail_url ?? "" : m.media_url ?? "", caption: (m.caption ?? "").slice(0, 160), type: m.media_type, at: m.timestamp }))
    .filter((p) => p.image);
  return { username: meJson.username ?? "", posts };
}

/** Cached feed for the home page (refreshed in the background when stale). Never throws. */
export async function getInstagramFeed(): Promise<{ username: string; posts: IgPost[] } | null> {
  const s = await getSettings();
  if (s.instagram_on !== "on" || !s.instagram_token) return null;
  type Cache = { at: number; username: string; posts: IgPost[] };
  let cache: Cache | null = null;
  try {
    const raw = await setting(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    cache = null;
  }
  if (cache && Date.now() - cache.at < CACHE_MS) return { username: cache.username || s.instagram_user, posts: cache.posts };
  try {
    const fresh = await fetchInstagram(s.instagram_token, 9, s.instagram_id);
    await put(CACHE_KEY, JSON.stringify({ at: Date.now(), ...fresh }));
    return { username: fresh.username || s.instagram_user, posts: fresh.posts };
  } catch {
    // Keep showing the last good feed (its image links stay valid for a while).
    return cache ? { username: cache.username || s.instagram_user, posts: cache.posts } : null;
  }
}

/** Cron: renew the long-lived token every ~20 days (they last 60) and keep the cache warm. */
export async function instagramMaintenance() {
  const s = await getSettings();
  if (!s.instagram_token) return;
  const last = Number(await setting("instagram_token_at")) || 0;
  // Only Instagram-Login tokens expire (60 days); system-user tokens never do.
  if (isIgLoginToken(s.instagram_token) && Date.now() - last > REFRESH_EVERY_MS) {
    try {
      const r = await fetch(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(s.instagram_token)}`, { signal: AbortSignal.timeout(12_000) });
      const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
      if (r.ok && j.access_token) {
        await put("instagram_token", j.access_token);
        await put("instagram_token_at", String(Date.now()));
      } else {
        await import("./activity").then((m) => m.logActivity("site", "instagram", `⚠️ Instagram token could not be renewed: ${j.error?.message ?? r.status} — paste a new one in Settings before it expires`, "warn")).catch(() => {});
        await put("instagram_token_at", String(Date.now() - REFRESH_EVERY_MS + 24 * 60 * 60_000)); // try again tomorrow
      }
    } catch {
      /* next time */
    }
  }
  if (s.instagram_on === "on") await getInstagramFeed();
}
