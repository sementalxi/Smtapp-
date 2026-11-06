import crypto from "node:crypto";
import type { NextRequest } from "next/server";

/** The Discord bot's private calls carry the shared secret KIXO_BOT_SECRET (same value on Vercel and Railway). */
export function botAuthorized(req: NextRequest) {
  const s = process.env.KIXO_BOT_SECRET?.trim();
  const got = req.headers.get("x-kixo-bot") ?? "";
  if (!s || got.length !== s.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(s));
}
