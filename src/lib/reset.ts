// Password reset links: signed, expire in 30 minutes, and stop working once the password changes.
import crypto from "node:crypto";
import { db } from "./db";

const key = () => process.env.AUTH_SECRET || process.env.DATABASE_URL || "kixo";
const sig = (data: string, hash: string) => crypto.createHmac("sha256", key()).update(`reset:${data}:${hash}`).digest("base64url").slice(0, 40);

export function makeResetToken(userId: string, passwordHash: string) {
  const data = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + 30 * 60_000 })).toString("base64url");
  return `${data}.${sig(data, passwordHash)}`;
}

/** Returns the user id if the link is valid. */
export async function readResetToken(token: string): Promise<string | null> {
  const [data, mac] = (token || "").split(".");
  if (!data || !mac) return null;
  try {
    const o = JSON.parse(Buffer.from(data, "base64url").toString()) as { u?: string; e?: number };
    if (!o.u || !o.e || Date.now() > o.e) return null;
    const u = await db.user.findUnique({ where: { id: o.u }, select: { passwordHash: true, banned: true } });
    if (!u || u.banned) return null;
    const good = sig(data, u.passwordHash);
    return good.length === mac.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(mac)) ? o.u : null;
  } catch {
    return null;
  }
}
