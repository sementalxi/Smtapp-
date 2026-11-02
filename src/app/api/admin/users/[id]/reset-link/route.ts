import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { makeResetToken } from "@/lib/reset";
import { siteUrl } from "@/lib/email-template";

/** Admin: a one-time password reset link for this user (valid 30 min) — open it or send it to them. */
export const POST = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } });
  if (!u) return json({ error: "not_found" }, 404);
  return json({ url: `${siteUrl()}/reset?t=${makeResetToken(u.id, u.passwordHash)}` });
});
