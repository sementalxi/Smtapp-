import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { LOG_CHANNELS, getLogHooks, saveLogHooks, testLog, type LogKey } from "@/lib/discord-logs";
import { discordWebhook } from "@/lib/discord";
import { botReady, createLogChannels, guildId } from "@/lib/discord-bot";

export const maxDuration = 60;

/** Which log channels are connected (never returns the webhook secrets). */
export const GET = handle(async () => {
  await apiAdmin();
  const h = await getLogHooks();
  return json({
    main: !!(await discordWebhook()),
    canAuto: botReady() && !!guildId(),
    channels: LOG_CHANNELS.map((c) => ({ key: c.key, label: c.label, labelEs: c.labelEs, connected: !!(h as Record<string, string>)[c.key] })),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("auto") }),
  z.object({ action: z.literal("set"), key: z.string(), url: z.string().max(300) }),
  z.object({ action: z.literal("test"), key: z.string() }),
]);

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const b = Body.parse(await req.json());
  const keys = LOG_CHANNELS.map((c) => c.key) as string[];
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
  return json({ ok: await testLog(b.key as LogKey) });
});
