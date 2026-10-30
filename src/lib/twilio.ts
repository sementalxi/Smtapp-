// Phone verification (Twilio Verify) and sending the finished poster by text (Twilio Messaging).
// Everything here is OFF until the Twilio keys are set in Vercel.
import { db } from "./db";

const sid = () => process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
const token = () => process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
const verifySid = () => process.env.TWILIO_VERIFY_SID?.trim() ?? "";
const from = () => process.env.TWILIO_FROM?.trim() ?? "";
const messagingSid = () => process.env.TWILIO_MESSAGING_SID?.trim() ?? "";

export const phoneVerifyReady = () => !!(sid() && token() && verifySid());
export const smsReady = () => !!(sid() && token() && (from() || messagingSid()));

/** "+1 (512) 555-0100" → "+15125550100"; null if it doesn't look like a real number. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  const digits = s.replace(/\D/g, "");
  const e164 = s.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

async function twilio(url: string, form: Record<string, string | string[]>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) (Array.isArray(v) ? v : [v]).forEach((x) => body.append(k, x));
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid()}:${token()}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; code?: number };
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message ?? "error"}`);
  return data;
}

export async function sendCode(phone: string, locale: string) {
  await twilio(`https://verify.twilio.com/v2/Services/${verifySid()}/Verifications`, { To: phone, Channel: "sms", Locale: locale === "en" ? "en" : "es" });
}

export async function checkCode(phone: string, code: string) {
  try {
    const r = await twilio(`https://verify.twilio.com/v2/Services/${verifySid()}/VerificationCheck`, { To: phone, Code: code });
    return r.status === "approved";
  } catch {
    return false;
  }
}

export async function phoneTaken(phone: string) {
  return !!(await db.user.findFirst({ where: { phone }, select: { id: true } }));
}

/** Texts the finished poster: a picture message in the US/Canada, a link elsewhere. */
export async function textPoster(opts: { userId: string; imageUrl: string; bannerId: string }) {
  try {
    if (!smsReady()) return;
    const on = await db.setting.findUnique({ where: { key: "sms_posters" } });
    if (on?.value === "0") return;
    const user = await db.user.findUnique({ where: { id: opts.userId }, select: { phone: true, locale: true, name: true } });
    if (!user?.phone) return;
    const base = (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/$/, "");
    if (!base) return;
    const img = opts.imageUrl.startsWith("http") ? opts.imageUrl : `${base}${opts.imageUrl}`;
    const link = `${base}/banner/${opts.bannerId}`;
    const es = user.locale !== "en";
    const text = es ? `🔥 ¡Tu póster KIXO está listo! Descárgalo en todos los tamaños: ${link}` : `🔥 Your KIXO poster is ready! Download it in every size: ${link}`;
    const mms = user.phone.startsWith("+1");
    await twilio(`https://api.twilio.com/2010-04-01/Accounts/${sid()}/Messages.json`, {
      To: user.phone,
      ...(messagingSid() ? { MessagingServiceSid: messagingSid() } : { From: from() }),
      Body: text,
      ...(mms ? { MediaUrl: img } : {}),
    });
  } catch (e) {
    console.error("text poster failed", e);
  }
}
