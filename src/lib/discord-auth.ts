// "Continue with Discord" sign-in / sign-up (OAuth2). OFF until DISCORD_CLIENT_ID + DISCORD_CLIENT_SECRET are set.
import crypto from "node:crypto";
import { siteUrl } from "./email-template";

export const discordAuthReady = () => !!(process.env.DISCORD_CLIENT_ID?.trim() && process.env.DISCORD_CLIENT_SECRET?.trim());
/** Same host the visitor is on (so the state cookie comes back); falls back to the site URL. */
export const discordRedirectUri = (req?: { headers: { get(n: string): string | null } }) => {
  const host = req?.headers.get("x-forwarded-host") || req?.headers.get("host");
  const base = host && !host.startsWith("localhost") ? `https://${host}` : siteUrl();
  return `${base}/api/auth/discord/callback`;
};
export const DISCORD_STATE_COOKIE = "kixo_dstate";

const sig = (data: string) => crypto.createHmac("sha256", process.env.DISCORD_CLIENT_SECRET!.trim()).update(data).digest("base64url").slice(0, 32);

/** Signed state — works even if the browser loses the cookie (e.g. iPhone opening the Discord app). */
export function makeState(next: string, link: boolean) {
  const data = Buffer.from(JSON.stringify({ n: next, l: link ? 1 : 0, t: Date.now(), r: crypto.randomBytes(6).toString("hex") })).toString("base64url");
  return `${data}.${sig(data)}`;
}
export function readState(state: string | null): { next: string; link: boolean } | null {
  if (!state) return null;
  const [data, mac] = state.split(".");
  if (!data || !mac || mac.length !== 32 || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig(data)))) return null;
  try {
    const o = JSON.parse(Buffer.from(data, "base64url").toString()) as { n?: string; l?: number; t?: number };
    if (!o.t || Date.now() - o.t > 15 * 60_000) return null;
    return { next: typeof o.n === "string" ? o.n : "", link: o.l === 1 };
  } catch {
    return null;
  }
}
