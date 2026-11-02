// Promo emails through Resend (resend.com). OFF until RESEND_API_KEY is set in Vercel.
import crypto from "node:crypto";
export { renderEmail, type Campaign } from "./email-template";
import { siteUrl } from "./email-template";

export const emailReady = () => !!process.env.RESEND_API_KEY?.trim();
const from = () => process.env.EMAIL_FROM?.trim() || "KIXO <hello@kixo.pro>";

const key = () => process.env.AUTH_SECRET || process.env.DATABASE_URL || "kixo";
/** Signed token so an unsubscribe link only works for its own user. */
export const unsubToken = (userId: string) => crypto.createHmac("sha256", key()).update(`unsub:${userId}`).digest("base64url").slice(0, 32);
export const unsubUrl = (userId: string) => `${siteUrl()}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId)}`;

/** Sends up to 100 emails in one Resend call. */
export async function sendBatch(items: { to: string; subject: string; html: string; unsub: string }[]) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      items.map((m) => ({
        from: from(),
        to: [m.to],
        subject: m.subject,
        html: m.html,
        headers: { "List-Unsubscribe": `<${m.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      })),
    ),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** One transactional email (e.g. password reset). */
export async function sendOne(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: from(), to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}
