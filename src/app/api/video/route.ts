import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { startVideo, videoPrices } from "@/lib/ai-video";

export const maxDuration = 60;

/** Prices + this poster's videos. */
export const GET = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const bannerId = req.nextUrl.searchParams.get("bannerId") ?? "";
  const p = await videoPrices();
  const jobs = bannerId ? await db.videoJob.findMany({ where: { userId: user.id, bannerId }, orderBy: { createdAt: "desc" }, take: 6 }) : [];
  return json({ on: p.on, five: p.five, ten: p.ten, credits: user.credits, jobs: jobs.map((j) => ({ id: j.id, status: j.status, videoUrl: j.videoUrl, seconds: j.seconds, error: j.status === "failed" ? (j.error?.startsWith("blocked") ? "blocked" : "failed") : null })) });
});

const Body = z.object({ bannerId: z.string().min(1).max(40), seconds: z.union([z.literal(5), z.literal(10)]), audio: z.boolean().default(true), motion: z.string().max(20).default("epic"), extra: z.string().trim().max(300).optional() });

/** Make an AI video from one of my finished posters. */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "video", 10, 60 * 60_000, user.id);
  const b = Body.parse(await req.json());
  const banner = await db.banner.findFirst({ where: { id: b.bannerId, userId: user.id, status: "READY" }, select: { id: true, finalUrl: true } });
  if (!banner?.finalUrl) throw new HttpError(404, "not_found");
  try {
    const j = await startVideo({ userId: user.id, bannerId: banner.id, imageUrl: banner.finalUrl, seconds: b.seconds, audio: b.audio, motion: b.motion, extra: b.extra });
    return json({ id: j.id });
  } catch (e) {
    const code = (e as { status?: number }).status;
    if (e instanceof HttpError) throw e;
    return json({ error: e instanceof Error ? e.message : "video_failed" }, code ?? 500);
  }
});
