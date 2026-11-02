import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { readResetToken } from "@/lib/reset";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

/** Sets the new password from a reset link and logs the user in. */
export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "reset", 10, 60 * 60_000);
  const b = z.object({ t: z.string().min(10).max(600), password: z.string().min(8).max(200) }).parse(await req.json());
  const userId = await readResetToken(b.t);
  if (!userId) return json({ error: "expired" }, 400);
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(b.password, 11) } });
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
  return res;
});
