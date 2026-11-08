import { NextRequest, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError, isStaff } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { assertOwnUrl } from "@/lib/banners";
import { BLOCKED, proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { changeCredits } from "@/lib/credits";
import { runStreamKit, STREAM_PIECES, STREAM_VIBES, type StreamItem } from "@/lib/stream-kit";

export const maxDuration = 800;

const Body = z.object({
  name: z.string().trim().min(1).max(30),
  content: z.string().trim().max(80).default(""),
  vibe: z.enum(STREAM_VIBES).default("neon"),
  colors: z.string().trim().max(100).default(""),
  socials: z.string().trim().max(60).default(""),
  schedule: z.string().trim().max(40).default(""),
  logoUrl: z.string().max(500).default(""),
  pieces: z.array(z.enum(STREAM_PIECES)).min(1).max(6),
});

/** Starts a streamer kit (charged per piece up front; failed pieces are refunded). */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "stream_kit", 8, 60 * 60_000, user.id);
  if (!proConfigured()) throw new HttpError(400, "pro_not_configured");
  const b = Body.parse(await req.json());
  if (b.logoUrl) assertOwnUrl(b.logoUrl);
  if (`${b.name} ${b.content} ${b.socials} ${b.schedule}`.match(BLOCKED)) return json({ error: "err_blocked" }, 400);
  const pieces = [...new Set(b.pieces)] as StreamItem["kind"][];
  const cost = isStaff(user.role) ? 0 : (await getNumberSetting("stream_piece_cost")) * pieces.length;
  if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);
  const items: StreamItem[] = pieces.map((kind) => ({ kind, status: "queued" }));
  const kit = await db.streamKit.create({ data: { userId: user.id, inputs: { ...b, pieces } as never, items: items as never, cost } });
  if (cost > 0) {
    try {
      await changeCredits({ userId: user.id, amount: -cost, type: "GENERATION", note: `Streamer kit: ${pieces.length} piece(s) for ${b.name}` });
    } catch {
      await db.streamKit.delete({ where: { id: kit.id } });
      return json({ error: "err_credits" }, 402);
    }
  }
  after(async () => {
    try {
      await runStreamKit(kit.id);
    } catch (e) {
      console.error("stream kit failed", e);
      await db.streamKit.update({ where: { id: kit.id }, data: { status: "DONE" } }).catch(() => {});
    }
  });
  return json({ kit: { id: kit.id, status: kit.status, items, inputs: kit.inputs } });
});

/** The player's recent kits. */
export const GET = handle(async () => {
  const user = await apiUser();
  const kits = await db.streamKit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  return json({ kits: kits.map((k) => ({ id: k.id, status: k.status, items: k.items, inputs: k.inputs, createdAt: k.createdAt })) });
});
