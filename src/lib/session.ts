// Edge-safe session helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bf_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let cached: Uint8Array | null = null;

/**
 * Signing key for sessions. Uses AUTH_SECRET when set; otherwise derives a key
 * from DATABASE_URL (already a secret) so a fresh deploy works with no extra setup.
 */
async function secret() {
  if (cached) return cached;
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) {
    cached = new TextEncoder().encode(s);
  } else {
    const base = process.env.DATABASE_URL;
    if (!base) throw new Error("Set AUTH_SECRET or DATABASE_URL");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bf-session:${base}`));
    cached = new Uint8Array(digest);
  }
  return cached;
}

export async function signSession(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(await secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
