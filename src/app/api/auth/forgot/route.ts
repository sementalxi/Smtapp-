import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { makeResetToken } from "@/lib/reset";
import { emailReady, sendOne } from "@/lib/email";
import { siteUrl } from "@/lib/email-template";
import { botReady, dmUser } from "@/lib/discord-bot";

/** Sends a reset link by Discord DM (if linked) and/or email. Never reveals whether the account exists. */
export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "forgot", 5, 60 * 60_000);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(await req.json());
  const u = await db.user.findUnique({ where: { email }, select: { id: true, name: true, passwordHash: true, discordId: true, banned: true, locale: true } });
  const channels: string[] = [];
  if (u && !u.banned) {
    const link = `${siteUrl()}/reset?t=${makeResetToken(u.id, u.passwordHash)}`;
    const es = u.locale === "es";
    if (u.discordId && botReady()) {
      const r = await dmUser(u.discordId, {
        title: es ? "🔐 Restablecer tu contraseña" : "🔐 Reset your password",
        content: es ? `Hola ${u.name}, toca el botón para crear una contraseña nueva. El enlace vence en 30 minutos. Si no lo pediste, ignora este mensaje.` : `Hi ${u.name}, tap the button to set a new password. The link expires in 30 minutes. If you didn't ask for this, ignore this message.`,
        linkUrl: link,
        linkLabel: es ? "Nueva contraseña" : "Set new password",
      }).catch(() => "error");
      if (r === "ok") channels.push("discord");
    }
    if (emailReady()) {
      const html = `<div style="font-family:Arial,sans-serif;background:#0d090f;color:#fff;padding:32px;border-radius:16px;max-width:520px;margin:auto">
<h2 style="margin:0 0 12px">${es ? "Restablecer contraseña" : "Reset your password"}</h2>
<p style="color:#cbb8cf">${es ? `Hola ${u.name}, toca el botón para crear una contraseña nueva. Vence en 30 minutos.` : `Hi ${u.name}, tap the button to set a new password. It expires in 30 minutes.`}</p>
<p><a href="${link}" style="display:inline-block;background:#ff2e88;color:#0d090f;font-weight:bold;padding:12px 22px;border-radius:10px;text-decoration:none">${es ? "Nueva contraseña" : "Set new password"}</a></p>
<p style="color:#7d6d80;font-size:12px">${es ? "Si no lo pediste, ignora este correo." : "If you didn't ask for this, ignore this email."}</p></div>`;
      await sendOne(email, es ? "Restablece tu contraseña de KIXO" : "Reset your KIXO password", html).then(() => channels.push("email")).catch(() => {});
    }
  }
  // Same answer either way, so nobody can test which emails have accounts.
  return json({ ok: true, ways: { discord: botReady(), email: emailReady() } });
});
