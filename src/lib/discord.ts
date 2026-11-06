import { badgeLabel, crestModeLabel, parseBadges } from "./templates";
import { db } from "./db";
import { getSettings } from "./settings";
import { appUrl } from "./stripe";

/** The admin's Discord webhook (Admin → Settings), or the DISCORD_WEBHOOK_URL env var. */
export async function discordWebhook() {
  const fromDb = (await getSettings().catch(() => null))?.discord_webhook?.trim();
  const url = fromDb || process.env.DISCORD_WEBHOOK_URL?.trim() || "";
  return /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url) ? url : "";
}

export let lastDiscordError = "";
export async function postToDiscord(payload: Record<string, unknown>, image?: { bytes: Buffer; name: string; type: string }, webhook?: string) {
  const url = webhook ?? (await discordWebhook());
  if (!url) { lastDiscordError = "no_channel"; return false; }
  const send = async (withImage: boolean) => {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ username: "KIXO Log", allowed_mentions: { parse: [] }, ...payload }));
    if (withImage && image) form.append("files[0]", new Blob([new Uint8Array(image.bytes)], { type: image.type }), image.name);
    const res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(withImage ? 20000 : 10000) });
    if (!res.ok) lastDiscordError = `discord_${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`;
    return res;
  };
  try {
    let res = await send(!!image);
    // Discord rate limit (bursts of posts): wait what it asks for and try again, same post, picture included — nothing gets lost.
    for (let tries = 0; res.status === 429 && tries < 4; tries++) {
      let wait = 3000;
      try {
        const j = JSON.parse(await res.clone().text()) as { retry_after?: number };
        if (typeof j.retry_after === "number") wait = Math.min(20_000, Math.ceil(j.retry_after * 1000) + 250);
      } catch {}
      await new Promise((r) => setTimeout(r, wait));
      res = await send(!!image);
    }
    // Too big / slow image → still log it, just without the picture.
    if (!res.ok && image && res.status !== 404 && res.status !== 401 && res.status !== 429) res = await send(false);
    if (res.ok) lastDiscordError = "";
    return res.ok;
  } catch (e) {
    lastDiscordError = e instanceof Error ? e.message : "network";
    if (image) {
      try { const r = await send(false); if (r.ok) { lastDiscordError = ""; return true; } } catch {}
    }
    return false;
  }
}

/**
 * Spaces posts to one webhook at least `gapMs` apart (across all server instances, via a slot kept in the
 * database) so a batch of posters does not land in Discord as one burst that hides half of them. Waits at
 * most `maxWaitMs`. Never throws.
 */
export async function paceWebhook(webhook: string, gapMs = 5000, maxWaitMs = 45_000) {
  try {
    const { createHash } = await import("crypto");
    const key = `discord_slot:${createHash("sha1").update(webhook).digest("hex").slice(0, 20)}`;
    const now = Date.now();
    const row = await db.setting.findUnique({ where: { key }, select: { value: true } });
    const next = Math.max(now, Number(row?.value) || 0);
    const slot = Math.min(next, now + maxWaitMs);
    await db.setting.upsert({ where: { key }, create: { key, value: String(slot + gapMs) }, update: { value: String(slot + gapMs) } });
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  } catch {}
}

const LAYOUT_NAMES: Record<string, string> = {
  PLAYER: "Player card",
  CHAMPIONS: "Champions",
  MATCHDAY: "Match day",
  LINEUP: "Lineup",
  TOTW: "Team of the week",
  RESULT: "Result",
  STANDINGS: "Standings",
  LOGO: "Team logo",
  EVENT: "Tournament / event",
  QUALIFIERS: "Qualifiers",
  WINNERS: "Winners showcase",
};

/** 🎬 Logs a finished (or failed) AI video to Discord, with the video attached when it fits. Never throws. */
export async function logVideo(opts: { jobId: string; ok: boolean; bytes?: Buffer; url?: string; error?: string }) {
  try {
    const j = await db.videoJob.findUnique({ where: { id: opts.jobId } });
    if (!j) return;
    const [user, banner] = await Promise.all([
      db.user.findUnique({ where: { id: j.userId }, select: { name: true, email: true, credits: true } }),
      j.bannerId ? db.banner.findUnique({ where: { id: j.bannerId }, select: { title: true } }) : null,
    ]);
    const { hookFor } = await import("./discord-logs");
    const hook = await hookFor("videos");
    if (!hook) return;
    const link = opts.url ? (opts.url.startsWith("/") ? appUrl() + opts.url : opts.url) : "";
    const attach = opts.ok && opts.bytes && opts.bytes.length < 9.5 * 1024 * 1024;
    await postToDiscord(
      {
        username: "KIXO · AI videos",
        content: opts.ok && !attach && link ? link : undefined,
        embeds: [
          {
            title: opts.ok ? `🎬 ${banner?.title || "AI video"}` : `❌ AI video failed: ${banner?.title || ""}`,
            url: `${appUrl()}/admin/banners`,
            color: opts.ok ? 0xc026d3 : 0xff4d5e,
            fields: [
              { name: "User", value: `${user?.name ?? "?"}\n${user?.email ?? ""}`.slice(0, 1000), inline: true },
              { name: "Video", value: `${j.seconds}s · ${j.model}${j.audio ? " · 🔊 sound" : " · 🔇"}`, inline: true },
              { name: "Credits", value: opts.ok ? `−${j.cost} (left: ${user?.credits ?? "?"})` : `refunded ${j.cost}`, inline: true },
              ...(opts.error ? [{ name: "Error", value: opts.error.slice(0, 1000) }] : []),
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      attach ? { bytes: opts.bytes!, name: `kixo-video-${j.id}.mp4`, type: "video/mp4" } : undefined,
      hook,
    );
  } catch (e) {
    console.error("discord video log failed", e);
  }
}

/** Logs a finished (or failed) poster to Discord. Never throws — logging must not break generation. */
export async function logGeneration(opts: {
  bannerId: string;
  userId: string;
  cost: number;
  ok: boolean;
  regenerate?: boolean;
  image?: Buffer;
  error?: string;
}) {
  await import("./activity").then(async (m) => {
    const [u, b] = await Promise.all([db.user.findUnique({ where: { id: opts.userId }, select: { email: true } }), db.banner.findUnique({ where: { id: opts.bannerId }, select: { title: true, template: { select: { name: true } } } })]);
    return m.logActivity("site", opts.ok ? "poster" : "poster_failed", opts.ok ? `🖼️ Poster made: ${b?.title ?? ""} · ${b?.template.name ?? ""} · ${u?.email ?? ""}` : `❌ Poster failed: ${b?.title ?? ""} · ${u?.email ?? ""} — ${(opts.error ?? "").slice(0, 300)}`, opts.ok ? "info" : "error");
  }).catch(() => {});
  try {
    const [user, banner] = await Promise.all([
      db.user.findUnique({ where: { id: opts.userId }, select: { name: true, email: true, credits: true } }),
      db.banner.findUnique({ where: { id: opts.bannerId }, select: { title: true, design: true, inputs: true, logoUrl: true, prompt: true, template: { select: { name: true, layout: true, badge: true } } } }),
    ]);
    // The style's labels (⭐ Recommended · 🔥 Fire · 🎨 Photoshop · ✨ New), as the admin set them.
    const labels = parseBadges(banner?.template.badge).map((b) => badgeLabel(b, false)).join(" · ") || "—";
    const { hookFor, getLogHooks } = await import("./discord-logs");
    // Admin style-test runs go to their own "style tests" channel (only when that webhook is set — they would flood the others).
    const styleTest = (banner?.design as unknown as { styleTest?: string } | null)?.styleTest;
    if (styleTest) {
      const hooks = await getLogHooks();
      const testUrl = (hooks as Record<string, string>).styletest;
      if (!testUrl) return;
      const model = /^\[Made with: ([^\]]+)\]/.exec(banner?.prompt ?? "")?.[1] ?? "";
      const isPng = opts.image ? opts.image[0] === 0x89 : true;
      const name = `kixo-test-${opts.bannerId}.${isPng ? "png" : "jpg"}`;
      await paceWebhook(testUrl, 5000); // one test post every 5 s, so none gets lost in a burst
      await postToDiscord(
        {
          username: "KIXO · Style test",
          embeds: [
            {
              title: opts.ok ? `🧪 ${banner?.template.name || "Style"}` : `❌ Failed: ${banner?.template.name || "style"}`,
              url: `${appUrl()}/admin/style-test`,
              color: opts.ok ? 0x2fd0ff : 0xff4d5e,
              fields: [
                { name: "Type", value: (LAYOUT_NAMES[banner?.template.layout ?? ""] ?? "Poster").slice(0, 100), inline: true },
                { name: "Crest", value: crestModeLabel(banner?.inputs as { aiLogo?: string } | null, !!banner?.logoUrl), inline: true },
                { name: "Labels", value: labels.slice(0, 100), inline: true },
                ...(model ? [{ name: "Generator", value: model.slice(0, 100), inline: true }] : []),
                { name: "Run", value: String(styleTest).slice(0, 12), inline: true },
                ...(opts.error ? [{ name: "Error", value: opts.error.slice(0, 1000) }] : []),
              ],
              timestamp: new Date().toISOString(),
              ...(opts.ok && opts.image ? { image: { url: `attachment://${name}` } } : {}),
            },
          ],
        },
        opts.ok && opts.image && opts.image.length < 9.5 * 1024 * 1024 ? { bytes: opts.image, name, type: isPng ? "image/png" : "image/jpeg" } : undefined,
        testUrl,
      );
      return;
    }
    // Each flyer type goes to its own channel (falls back to the main webhook).
    const url = await hookFor(banner?.template.layout ?? "");
    if (!url) return;
    const teamSet = !!(banner?.design as unknown as { seriesRootId?: string } | null)?.seriesRootId;
    const kind = [LAYOUT_NAMES[banner?.template.layout ?? ""] ?? "Poster", teamSet ? "· team set" : "", opts.regenerate ? "· new version" : ""].join(" ").trim();
    const isPng = opts.image ? opts.image[0] === 0x89 : true;
    const name = `kixo-${opts.bannerId}.${isPng ? "png" : "jpg"}`;
    const embed: Record<string, unknown> = {
      title: opts.ok ? `🖼️ ${banner?.title || "New poster"}` : `❌ Failed: ${banner?.title || "poster"}`,
      url: `${appUrl()}/admin/banners`,
      color: opts.ok ? 0xff2e88 : 0xff4d5e,
      fields: [
        { name: "User", value: `${user?.name ?? "?"}\n${user?.email ?? ""}`.slice(0, 1000), inline: true },
        { name: "Type", value: kind.slice(0, 1000), inline: true },
        { name: "Style", value: (banner?.template.name || "—").slice(0, 1000), inline: true },
        { name: "Crest", value: crestModeLabel(banner?.inputs as { aiLogo?: string } | null, !!banner?.logoUrl), inline: true },
        { name: "Labels", value: labels.slice(0, 100), inline: true },
        { name: "Credits", value: opts.ok ? `−${opts.cost} (left: ${user?.credits ?? "?"})` : "refunded", inline: true },
        ...(opts.error ? [{ name: "Error", value: opts.error.slice(0, 1000) }] : []),
      ],
      timestamp: new Date().toISOString(),
      ...(opts.ok && opts.image ? { image: { url: `attachment://${name}` } } : {}),
    };
    await postToDiscord(
      { username: `KIXO · ${LAYOUT_NAMES[banner?.template.layout ?? ""] ?? "Posters"}`, embeds: [embed] },
      opts.ok && opts.image && opts.image.length < 9.5 * 1024 * 1024 ? { bytes: opts.image, name, type: isPng ? "image/png" : "image/jpeg" } : undefined,
      url,
    );
  } catch (e) {
    console.error("discord log failed", e);
  }
}
