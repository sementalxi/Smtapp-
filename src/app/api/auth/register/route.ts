import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/auth";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { getNumberSetting } from "@/lib/settings";
import { changeCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";
import { REF_COOKIE } from "@/lib/referral";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "register", 10, 60 * 60_000);
  const body = Body.parse(await req.json());

  if (await db.user.findUnique({ where: { email: body.email } })) {
    return json({ error: "err_exists" }, 409);
  }

  // Invited by a friend? (?ref=CODE link → cookie)
  const refCode = req.cookies.get(REF_COOKIE)?.value?.trim().toUpperCase();
  const referrer = refCode && /^[A-Z0-9]{4,12}$/.test(refCode) ? await db.user.findFirst({ where: { refCode }, select: { id: true } }) : null;

  const user = await db.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 11),
      // ADMIN_EMAILS get admin; if there's no admin yet, the first account becomes admin.
      role: isAdminEmail(body.email) || (await db.user.count({ where: { role: "ADMIN" } })) === 0 ? "ADMIN" : "USER",
      locale: req.cookies.get("bf_lang")?.value === "en" ? "en" : "es",
      referredById: referrer?.id ?? null,
    },
  });

  const bonus = await getNumberSetting("signup_credits");
  if (bonus > 0) await changeCredits({ userId: user.id, amount: bonus, type: "SIGNUP_BONUS", note: "Welcome bonus" });

  const res = json({ ok: true });
  if (referrer) res.cookies.delete(REF_COOKIE);
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  return res;
});
