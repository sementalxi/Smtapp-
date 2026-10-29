import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/auth";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "login", 20, 15 * 60_000);
  const body = Body.parse(await req.json());
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return json({ error: "err_invalid" }, 401);
  }
  if (user.banned) return json({ error: "err_banned" }, 403);

  // Promote emails listed in ADMIN_EMAILS (handy for the first login after deploy).
  if (user.role !== "ADMIN" && isAdminEmail(user.email)) {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }

  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  return res;
});
