import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { advanceVideo } from "@/lib/ai-video";

export const maxDuration = 60;

/** Polled by the page: moves the job along and returns its state. */
export const GET = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  const own = await db.videoJob.findFirst({ where: { id, userId: user.id } });
  if (!own) throw new HttpError(404, "not_found");
  const j = (await advanceVideo(id).catch(() => own)) ?? own;
  return json({ status: j.status, videoUrl: j.videoUrl, error: j.status === "failed" ? (j.error?.startsWith("blocked") ? "blocked" : "failed") : null, ...(user.role === "ADMIN" && j.error ? { detail: j.error } : {}) });
});
