import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { getSettings } from "@/lib/settings";
import { openTicket, readTicket, sendFromUser, supportReady } from "@/lib/support";

export const dynamic = "force-dynamic";

async function enabled() {
  return supportReady() && (await getSettings()).support_on !== "0";
}

/** The user's open ticket and its messages (polled by the chat pop-up). */
export const GET = handle(async () => {
  const user = await apiUser();
  if (!(await enabled())) return json({ enabled: false });
  const t = await db.supportTicket.findFirst({ where: { userId: user.id, status: "open" }, orderBy: { createdAt: "desc" } });
  if (!t) return json({ enabled: true, ticket: null, messages: [] });
  const r = await readTicket(t).catch(() => undefined);
  if (r === null || r?.closed) {
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "closed" } });
    return json({ enabled: true, ticket: null, messages: r?.messages ?? [], closed: true });
  }
  return json({ enabled: true, ticket: { id: t.id }, messages: r?.messages ?? [] });
});

const Body = z.object({ text: z.string().trim().max(1900).default(""), imageUrl: z.string().max(500).optional() });

/** Send a message (opens a ticket on the first message). */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "support", 40, 10 * 60_000, user.id);
  if (!(await enabled())) throw new HttpError(503, "support_off");
  const b = Body.parse(await req.json());
  if (!b.text && !b.imageUrl) throw new HttpError(400, "empty");
  const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
  const img = b.imageUrl ? (b.imageUrl.startsWith("/") ? site + b.imageUrl : b.imageUrl) : undefined;
  if (img && !/^https:\/\//.test(img)) throw new HttpError(400, "bad_image");
  let t;
  try {
    t = await openTicket(user.id);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 502);
  }
  let r = await sendFromUser(t, user, b.text, img);
  if (r === "gone") {
    // Staff deleted the channel — start a fresh ticket.
    await db.supportTicket.update({ where: { id: t.id }, data: { status: "closed" } });
    t = await openTicket(user.id);
    r = await sendFromUser(t, user, b.text, img);
  }
  return r === "ok" ? json({ ok: true }) : json({ error: "send_failed" }, 502);
});
