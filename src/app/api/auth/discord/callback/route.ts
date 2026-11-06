import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/auth";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { addToGuild } from "@/lib/discord-bot";
import { logSignup } from "@/lib/discord-logs";
import { getNumberSetting } from "@/lib/settings";
import { changeCredits } from "@/lib/credits";
import { REF_COOKIE } from "@/lib/referral";
import { discordAuthReady, discordRedirectUri, readState, DISCORD_STATE_COOKIE } from "@/lib/discord-auth";

const fail = (req: NextRequest, reason: string) => NextResponse.redirect(new URL(`/login?err=${encodeURIComponent(reason)}`, req.url));

/** Discord sends the visitor back here: log in, or create the account (with the sign-up bonus). */
export async function GET(req: NextRequest) {
  if (!discordAuthReady()) return fail(req, "discord_off");
  if (req.nextUrl.searchParams.get("error")) return fail(req, "discord_cancel");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const st = readState(state);
  if (!code || !st) {
    console.error("[discord] bad state", { hasCode: !!code, hasState: !!state, host: req.headers.get("host") });
    return fail(req, "discord_state");
  }
  const next = st.next;
  const mode = st.link ? "link" : "";

  const id = process.env.DISCORD_CLIENT_ID!.trim();
  const secret = process.env.DISCORD_CLIENT_SECRET!.trim();
  const exchange = (basic: boolean) =>
    fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(basic ? { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` } : {}),
      },
      body: new URLSearchParams({
        ...(basic ? {} : { client_id: id, client_secret: secret }),
        grant_type: "authorization_code",
        code,
        redirect_uri: discordRedirectUri(req),
      }),
    });
  let tokenRes = await exchange(false);
  if (tokenRes.status === 401) tokenRes = await exchange(true); // some apps only accept Basic auth
  const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!tok.access_token) {
    console.error("[discord] token exchange failed", tokenRes.status, tok.error, tok.error_description, discordRedirectUri(req));
    return fail(req, tok.error === "invalid_client" ? "discord_secret" : tok.error === "invalid_grant" ? "discord_redirect" : "discord_token");
  }
  const me = (await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({}))) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    email?: string | null;
    verified?: boolean;
  };
  if (!me.id) return fail(req, "discord_user");
  const discordName = (me.global_name || me.username || "").slice(0, 60) || null;
  const discordUser = (me.username || "").slice(0, 40) || null;
  const discordAvatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.${me.avatar.startsWith("a_") ? "gif" : "png"}?size=256` : null;
  // Join your KIXO server automatically (so the bot can DM them). Never blocks sign-in.
  await addToGuild(me.id, tok.access_token).catch(() => {});

  // Linking from the profile page (already logged in).
  if (mode === "link") {
    const back = (q: string) => {
      const r = NextResponse.redirect(new URL(`/profile?discord=${q}`, req.url));
      r.cookies.delete(DISCORD_STATE_COOKIE);
      return r;
    };
    const current = await getCurrentUser().catch(() => null);
    if (!current) return fail(req, "discord_state");
    const owner = await db.user.findFirst({ where: { discordId: me.id }, select: { id: true } });
    if (owner && owner.id !== current.id) return back("taken");
    const firstLink = !current.discordId;
    await db.user.update({ where: { id: current.id }, data: { discordId: me.id, discordName, discordUser, discordAvatar } });
    if (firstLink) await import("@/lib/welcome-dm").then((m) => m.sendWelcomeDm(current.id)).catch(() => {});
    // Discord admin role → website admin.
    await import("@/lib/discord-bot").then((m) => m.applyDiscordAdmin(current.id, me.id!)).catch(() => {});
    return back("linked");
  }
  const email = me.email?.trim().toLowerCase();
  if (!email || !me.verified) return fail(req, "discord_email");

  let user = await db.user.findFirst({ where: { discordId: me.id } });
  if (!user) user = await db.user.findUnique({ where: { email } });
  let isNew = false;
  if (user) {
    if (user.banned) return fail(req, "err_banned");
    await db.user.update({ where: { id: user.id }, data: { discordId: user.discordId || me.id, discordName, discordUser, discordAvatar } });
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
        discordName,
        discordUser,
        discordAvatar,
        referredById: referrer?.id ?? null,
      },
    });
    isNew = true;
    const bonus = await getNumberSetting("signup_credits");
    if (bonus > 0) await changeCredits({ userId: user.id, amount: bonus, type: "SIGNUP_BONUS", note: "Welcome bonus" });
    const dBonus = await getNumberSetting("discord_bonus").catch(() => 0);
    if (dBonus > 0) await changeCredits({ userId: user.id, amount: dBonus, type: "SIGNUP_BONUS", note: "Discord sign-up bonus" });
    await logSignup(user.id, "discord");
    await import("@/lib/welcome-dm").then((m) => m.sendWelcomeDm(user!.id)).catch(() => {});
  }

  // Discord admin role → website admin (and back, when the role was taken away).
  await import("@/lib/discord-bot").then((m) => m.applyDiscordAdmin(user!.id, me.id!)).catch(() => {});
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : isNew ? "/create" : "/dashboard";
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  res.cookies.delete(DISCORD_STATE_COOKIE);
  if (isNew) res.cookies.delete(REF_COOKIE);
  return res;
}
