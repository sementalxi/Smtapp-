import { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { normalizePhone, phoneTaken, phoneVerifyReady, sendCode } from "@/lib/twilio";

/** Sends a sign-up verification code by SMS. */
export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "phone_code", 6, 60 * 60_000);
  if (!phoneVerifyReady()) return json({ error: "phone_off" }, 400);
  const b = z.object({ phone: z.string().max(30) }).parse(await req.json());
  const phone = normalizePhone(b.phone);
  if (!phone) return json({ error: "err_phone_invalid" }, 400);
  if (await phoneTaken(phone)) return json({ error: "err_phone_used" }, 409);
  try {
    await sendCode(phone, req.cookies.get("bf_lang")?.value ?? "es");
  } catch (e) {
    console.error("send code failed", e);
    return json({ error: "err_phone_send" }, 502);
  }
  return json({ ok: true, phone });
});
