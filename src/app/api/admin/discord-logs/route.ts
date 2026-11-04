import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { LOG_CHANNELS, getLogHooks, saveLogHooks, testLog, getShowcaseHook, setShowcaseHook, getShowcaseHooks, saveShowcaseHooks, SHOWCASE_TYPES, type LogKey } from "@/lib/discord-logs";
import { postToDiscord } from "@/lib/discord";
import { discordWebhook } from "@/lib/discord";
import { botReady, createLogChannels, createWebhookIn, guildId } from "@/lib/discord-bot";
import { getShowcaseMap, syncShowcaseChannels } from "@/lib/showcase-sync";

export const maxDuration = 60;

/** Which log channels are connected (never returns the webhook secrets). */
export const GET = handle(async () => {
  await apiAdmin();
  const h = await getLogHooks();
  return json({
    main: !!(await discordWebhook()),
    canAuto: botReady() && !!guildId(),
    bot: botReady(),
    showcase: !!(await getShowcaseHook()),
    showcaseTypes: await (async () => {
      const [h, map] = await Promise.all([getShowcaseHooks() as Promise<Record<string, string>>, getShowcaseMap()]);
      return SHOWCASE_TYPES.map((t) => ({ key: t.key, label: t.label, labelEs: t.labelEs, connected: !!h[t.key], channel: h[t.key] ? map[t.key]?.name ?? null : null }));
    })(),
    channels: LOG_CHANNELS.map((c) => ({ key: c.key, label: c.label, labelEs: c.labelEs, connected: !!(h as Record<string, string>)[c.key] })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto") }),
  z.object({ action: z.literal("set"), key: z.string(), url: z.string().max(300) }),
  z.object({ action: z.literal("test"), key: z.string() }),
  z.object({ action: z.literal("showcase_set"), url: z.string().max(300) }),
  z.object({ action: z.literal("showcase_channel"), channelId: z.string().regex(/^\d{15,22}$/) }),
  z.object({ action: z.literal("showcase_test") }),
  z.object({ action: z.literal("showcase_auto") }),
  z.object({ action: z.literal("showcase_type"), key: z.string(), channelId: z.string().regex(/^\d{15,22}$/).or(z.literal("")) }),
]);

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const b = Body.parse(await req.json());
  const keys = LOG_CHANNELS.map((c) => c.key) as string[];
  if (b.action === "showcase_set") {
    const u = b.url.trim();
    if (u && !/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(u)) return json({ error: "bad_url" }, 400);
    await setShowcaseHook(u);
    return json({ ok: true });
  }
  if (b.action === "showcase_channel") {
    const r = await createWebhookIn(b.channelId);
    if (!r.url) return json({ error: r.error }, 400);
    await setShowcaseHook(r.url);
    return json({ ok: true });
  }
  if (b.action === "showcase_auto") {
    // One channel per poster type the website shows: match existing channels by name, create the missing ones.
    const r = await syncShowcaseChannels({ create: true });
    if (!r.ok) return json({ error: r.error ?? "failed", done: r.done }, 400);
    return json({ ok: true, done: r.done, created: r.created, skipped: r.skipped ?? [], unchanged: r.done.length === 0 });
  }
  if (b.action === "showcase_type") {
    const t = SHOWCASE_TYPES.find((x) => x.key === b.key);
    if (!t) return json({ error: "bad_key" }, 400);
    const hooks = { ...(await getShowcaseHooks()) } as Record<string, string>;
    if (!b.channelId) delete hooks[t.key];
    else {
      const r = await createWebhookIn(b.channelId);
      if (!r.url) return json({ error: r.error }, 400);
      hooks[t.key] = r.url;
    }
    await saveShowcaseHooks(hooks);
    return json({ ok: true });
  }
  if (b.action === "showcase_test") {
    const url = await getShowcaseHook();
    if (!url) return json({ error: "not_set" }, 400);
    const ok = await postToDiscord({ username: "KIXO Showcase", embeds: [{ title: "🔥 KIXO Showcase is live", description: "New posters made on kixo.pro will show up here.", url: "https://kixo.pro/create", color: 0xff2e88 }] }, undefined, url);
    return json({ ok });
  }
  if (b.action === "auto") {
    const r = await createLogChannels(LOG_CHANNELS);
    if (r.hooks && Object.keys(r.hooks).length) await saveLogHooks({ ...(await getLogHooks()), ...r.hooks });
    return json(r.ok ? { ok: true } : { error: r.error }, r.ok ? 200 : 400);
  }
  if (!keys.includes(b.key)) return json({ error: "bad_key" }, 400);
  if (b.action === "set") {
    const h = { ...(await getLogHooks()) } as Record<string, string>;
    if (b.url.trim()) h[b.key] = b.url.trim();
    else delete h[b.key];
    await saveLogHooks(h);
    return json({ ok: true });
  }
  return json(await testLog(b.key as LogKey));
});
