import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/auth";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { getNumberSetting } from "@/lib/settings";
import { changeCredits } from "@/lib/credits";
import { REF_COOKIE } from "@/lib/referral";
import { discordAuthReady, discordRedirectUri, DISCORD_STATE_COOKIE } from "@/lib/discord-auth";

const fail = (req: NextRequest, reason: string) => NextResponse.redirect(new URL(`/login?err=${encodeURIComponent(reason)}`, req.url));

/** Discord sends the visitor back here: log in, or create the account (with the sign-up bonus). */
export async function GET(req: NextRequest) {
  if (!discordAuthReady()) return fail(req, "discord_off");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [savedState, next] = (req.cookies.get(DISCORD_STATE_COOKIE)?.value ?? "").split("|");
  if (!code || !state || state !== savedState) return fail(req, "discord_state");

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!.trim(),
      client_secret: process.env.DISCORD_CLIENT_SECRET!.trim(),
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(),
    }),
  });
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tok.access_token) return fail(req, "discord_token");
  const me = (await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}))) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    email?: string | null;
    verified?: boolean;
  };
  if (!me.id) return fail(req, "discord_user");
  const email = me.email?.trim().toLowerCase();
  if (!email || !me.verified) return fail(req, "discord_email");

  let user = await db.user.findFirst({ where: { discordId: me.id } });
  if (!user) user = await db.user.findUnique({ where: { email } });
  let isNew = false;
  if (user) {
    if (user.banned) return fail(req, "err_banned");
    if (!user.discordId) await db.user.update({ where: { id: user.id }, data: { discordId: me.id } });
  } else {
    const refCode = req.cookies.get(REF_COOKIE)?.value?.trim().toUpperCase();
    const referrer = refCode && /^[A-Z0-9]{4,12}$/.test(refCode) ? await db.user.findFirst({ where: { refCode }, select: { id: true } }) : null;
    user = await db.user.create({
      data: {
        name: (me.global_name || me.username || email.split("@")[0]).slice(0, 60),
        email,
        // No password — they log in with Discord (a random one is stored so password login can't be guessed).
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
        role: isAdminEmail(email) ? "ADMIN" : "USER",
        locale: req.cookies.get("bf_lang")?.value === "en" ? "en" : "es",
        discordId: me.id,
        referredById: referrer?.id ?? null,
      },
    });
    isNew = true;
    const bonus = await getNumberSetting("signup_credits");
    if (bonus > 0) await changeCredits({ userId: user.id, amount: bonus, type: "SIGNUP_BONUS", note: "Welcome bonus" });
  }

  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : isNew ? "/create" : "/dashboard";
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  res.cookies.delete(DISCORD_STATE_COOKIE);
  if (isNew) res.cookies.delete(REF_COOKIE);
  return res;
}
