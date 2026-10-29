import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { postToDiscord } from "@/lib/discord";

// Admin: sends a test message to a Discord webhook URL.
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { url } = z.object({ url: z.string().max(300) }).parse(await req.json());
  if (!/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url.trim())) return json({ error: "bad_url" }, 400);
  const ok = await postToDiscord({ content: "✅ KIXO is connected — new posters will show up here." }, undefined, url.trim()).catch(() => false);
  return ok ? json({ ok: true }) : json({ error: "send_failed" }, 400);
});
