// Keeps the Discord showcase channels in step with the website: one public channel per poster type the site
// shows (player cards, team cards, champions, lineups, match day, results, team logos, standings, tournaments).
// Existing channels are matched by name — however they're styled (emoji, "・", sᴍᴀʟʟ ᴄᴀᴘs, ｆｕｌｌｗｉｄｔｈ) — and
// connected with a webhook; types with no channel get one created inside the same category.
import { db } from "./db";
import { SHOWCASE_TYPES, getShowcaseHooks, saveShowcaseHooks } from "./discord-logs";
import { botReady, createCategory, createTextChannel, createWebhookIn, guildId, listAllChannels } from "./discord-bot";
import { visibleCategories } from "./categories";

const ICON: Record<string, string> = { TEAM: "👥", PLAYER: "🧍", CHAMPIONS: "🏆", MATCHDAY: "📅", LINEUP: "📋", RESULT: "⚽", EVENT: "🎟️", STANDINGS: "📊", LOGO: "🛡️" };
const SMALL_CAPS: Record<string, string> = { ᴀ: "a", ʙ: "b", ᴄ: "c", ᴅ: "d", ᴇ: "e", ꜰ: "f", ɢ: "g", ʜ: "h", ɪ: "i", ᴊ: "j", ᴋ: "k", ʟ: "l", ᴍ: "m", ɴ: "n", ᴏ: "o", ᴘ: "p", ǫ: "q", ʀ: "r", ꜱ: "s", ᴛ: "t", ᴜ: "u", ᴠ: "v", ᴡ: "w", ʏ: "y", ᴢ: "z" };

/** "👥・ᴛᴇᴀᴍ-ᴄᴀʀᴅꜱ" → "team-cards": plain letters so the type matchers can read any channel name style. */
export function plainChannelName(name: string) {
  return name
    .normalize("NFKC")
    .split("")
    .map((ch) => SMALL_CAPS[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

type Chan = { id: string; name: string; type: number; parent_id?: string | null };
export type SyncReport = { ok: boolean; done: string[]; created: string[]; error?: string; skipped?: string[] };

/** The map of type → connected channel (for the admin page). */
export async function getShowcaseMap(): Promise<Record<string, { id: string; name: string }>> {
  const s = await db.setting.findUnique({ where: { key: "discord_showcase_map" } }).catch(() => null);
  try {
    return s ? (JSON.parse(s.value) as Record<string, { id: string; name: string }>) : {};
  } catch {
    return {};
  }
}

async function webhookAlive(url: string) {
  try {
    const r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    return r.status !== 404 && r.status !== 401;
  } catch {
    return true; // network hiccup — don't throw a good webhook away
  }
}

/**
 * Connects every poster type the website shows to its Discord channel; with `create`, makes the missing channels
 * (in the category where the other showcase channels live). Never throws.
 */
export async function syncShowcaseChannels(opts: { create: boolean }): Promise<SyncReport> {
  const done: string[] = [];
  const created: string[] = [];
  const skipped: string[] = [];
  try {
    if (!botReady() || !guildId()) return { ok: false, done, created, error: "missing" };
    const all = await listAllChannels();
    if (!all.length) return { ok: false, done, created, error: "no_channels" };
    const visible = new Set<string>(await visibleCategories().catch(() => []));
    if (visible.has("PLAYER")) visible.add("TEAM"); // team cards are player cards made for a whole squad
    const types = SHOWCASE_TYPES.filter((t) => visible.size === 0 || visible.has(t.key));

    const textish = (c: Chan) => c.type === 0 || c.type === 5;
    const chans = all.filter((c) => textish(c) || c.type === 15 || c.type === 16).map((c) => ({ ...c, plain: plainChannelName(c.name) }));
    const hooks = { ...(await getShowcaseHooks()) } as Record<string, string>;
    const map = await getShowcaseMap();
    const used = new Set<string>();
    const matched: { t: (typeof SHOWCASE_TYPES)[number]; ch: (Chan & { plain: string }) | null }[] = [];
    for (const t of types) {
      // The channel it's already connected to wins; otherwise the first channel whose plain name fits the type.
      const known = map[t.key]?.id ? chans.find((c) => c.id === map[t.key].id) : undefined;
      const ch = known ?? chans.find((c) => !used.has(c.id) && t.match.test(c.plain)) ?? null;
      if (ch) used.add(ch.id);
      matched.push({ t, ch });
    }

    // Where new channels go: the category most of the existing showcase channels live in.
    const parents = matched.map((m) => m.ch?.parent_id).filter((p): p is string => !!p);
    let parent: string | null | undefined = parents.sort((a, b) => parents.filter((x) => x === b).length - parents.filter((x) => x === a).length)[0];
    const styled = matched.some((m) => m.ch && /・|\p{Extended_Pictographic}/u.test(m.ch.name)); // "👥・team-cards" style names

    for (const { t, ch } of matched) {
      if (ch) {
        if (!textish(ch)) {
          skipped.push(`${t.label} → #${ch.name} (forum channel — posts need a normal text channel)`);
          continue;
        }
        if (hooks[t.key] && map[t.key]?.id === ch.id && (await webhookAlive(hooks[t.key]))) {
          map[t.key] = { id: ch.id, name: ch.name };
          continue; // already connected and working
        }
        const r = await createWebhookIn(ch.id);
        if (r.error) return { ok: false, done, created, skipped, error: r.error };
        hooks[t.key] = r.url!;
        map[t.key] = { id: ch.id, name: ch.name };
        done.push(`${t.label} → #${ch.name}`);
        continue;
      }
      if (!opts.create) {
        skipped.push(`${t.label}: no channel`);
        continue;
      }
      if (parent === undefined) {
        const cat = all.find((c) => c.type === 4 && /design|showcase|vitrina|diseñ/i.test(c.name)) ?? all.find((c) => c.type === 4 && /kixo/i.test(c.name) && !/log|studio|estudio/i.test(c.name));
        parent = cat?.id ?? (await createCategory("🎨 KIXO DESIGNS")).id ?? null;
      }
      const name = styled ? `${ICON[t.key] ?? "🔥"}・${t.channel}` : t.channel;
      const made = await createTextChannel(name, parent, `KIXO · ${t.label.replace(/^\S+\s/, "")} made on kixo.pro`);
      if (!made.id) return { ok: false, done, created, skipped, error: made.error };
      const r = await createWebhookIn(made.id);
      if (r.error) return { ok: false, done, created, skipped, error: r.error };
      hooks[t.key] = r.url!;
      map[t.key] = { id: made.id, name };
      created.push(`#${name}`);
      done.push(`${t.label} → #${name} (created)`);
    }
    await saveShowcaseHooks(hooks);
    await db.setting.upsert({ where: { key: "discord_showcase_map" }, create: { key: "discord_showcase_map", value: JSON.stringify(map) }, update: { value: JSON.stringify(map) } });
    if (created.length || done.length) {
      await import("./activity").then((m) => m.logActivity("site", "discord", `🌍 Discord showcase: ${created.length ? `created ${created.join(", ")} · ` : ""}connected ${done.length} channel${done.length === 1 ? "" : "s"}`)).catch(() => {});
    }
    return { ok: true, done, created, skipped };
  } catch (e) {
    return { ok: false, done, created, skipped, error: e instanceof Error ? e.message : "failed" };
  }
}

const SYNC_EVERY_MS = 6 * 60 * 60_000;

/** For the cron: checks a few times a day that every poster type on the site has its channel (and makes the missing ones). */
export async function syncShowcaseIfDue() {
  if (!botReady() || !guildId()) return;
  const KEY = "showcase_sync_at";
  const s = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  const last = s?.value ? Date.parse(s.value) : 0;
  if (last && Date.now() - last < SYNC_EVERY_MS) return;
  // Claim the slot first so overlapping cron ticks don't both run it.
  const now = new Date().toISOString();
  const claimed = s
    ? (await db.setting.updateMany({ where: { key: KEY, value: s.value }, data: { value: now } })).count === 1
    : (await db.setting.createMany({ data: [{ key: KEY, value: now }], skipDuplicates: true })).count === 1;
  if (!claimed) return;
  const r = await syncShowcaseChannels({ create: true });
  if (!r.ok && r.error && r.error !== "missing") {
    await import("./activity").then((m) => m.logActivity("site", "discord", `⚠️ Discord showcase channels couldn't be checked: ${r.error}${r.error === "no_permission" ? " — give the KIXO bot “Manage Channels” + “Manage Webhooks”" : ""}`, "warn")).catch(() => {});
  }
}
