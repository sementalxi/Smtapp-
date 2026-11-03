import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { getWelcomeDm, saveWelcomeDm, sendWelcomeDm } from "@/lib/welcome-dm";
import { lastDmError } from "@/lib/discord-bot";

const Msg = z.object({
  on: z.boolean(),
  title: z.string().max(250),
  content: z.string().max(4000),
  imageUrls: z.array(z.string().max(500)).max(4),
  linkUrl: z.string().max(500).refine((u) => !u || /^https:\/\//.test(u), "Link must start with https://"),
  linkLabel: z.string().max(80),
});

export const GET = handle(async () => {
  await apiAdmin();
  return json(await getWelcomeDm());
});

export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const b = Msg.parse(await req.json());
  for (const u of b.imageUrls) assertOwnUrl(u);
  await saveWelcomeDm(b);
  return json({ ok: true });
});

/** Send the (unsaved) message to yourself as a test. */
export const POST = handle(async (req: NextRequest) => {
  const me = await apiAdmin();
  const b = Msg.parse(await req.json());
  const r = await sendWelcomeDm(me.id, { force: true, preview: b });
  return json({ result: r, detail: r === "ok" ? undefined : lastDmError || undefined });
});
