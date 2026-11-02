// "Continue with Discord" sign-in / sign-up (OAuth2). OFF until DISCORD_CLIENT_ID + DISCORD_CLIENT_SECRET are set.
import { siteUrl } from "./email-template";

export const discordAuthReady = () => !!(process.env.DISCORD_CLIENT_ID?.trim() && process.env.DISCORD_CLIENT_SECRET?.trim());
export const discordRedirectUri = () => `${siteUrl()}/api/auth/discord/callback`;
export const DISCORD_STATE_COOKIE = "kixo_dstate";
