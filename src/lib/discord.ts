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
    // Too big / slow image → still log it, just without the picture.
    if (!res.ok && image && res.status !== 404 && res.status !== 401) res = await send(false);
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

const LAYOUT_NAMES: Record<string, string> = {
  PLAYER: "Player card",
  CHAMPIONS: "Champions",
  MATCHDAY: "Match day",
  LINEUP: "Lineup",
  RESULT: "Result",
  EVENT: "Tournament / event",
};

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
  try {
    const [user, banner] = await Promise.all([
      db.user.findUnique({ where: { id: opts.userId }, select: { name: true, email: true, credits: true } }),
      db.banner.findUnique({ where: { id: opts.bannerId }, select: { title: true, design: true, template: { select: { name: true, layout: true } } } }),
    ]);
    // Each flyer type goes to its own channel (falls back to the main webhook).
    const { hookFor } = await import("./discord-logs");
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
        { name: "Type", value: `${kind}\n${banner?.template.name ?? ""}`.slice(0, 1000), inline: true },
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
