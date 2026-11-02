import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { discordAuthReady, discordRedirectUri, DISCORD_STATE_COOKIE } from "@/lib/discord-auth";

/** Sends the visitor to Discord to approve "KIXO wants to see your username and email". */
export async function GET(req: NextRequest) {
  if (!discordAuthReady()) return NextResponse.redirect(new URL("/register", req.url));
  let next = req.nextUrl.searchParams.get("next") || "";
  if (!next.startsWith("/") || next.startsWith("//")) next = "";
  const link = req.nextUrl.searchParams.get("link") === "1";
  if (link) next = "/profile";
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID!.trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", discordRedirectUri());
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", link ? "consent" : "none");
  const res = NextResponse.redirect(url);
  res.cookies.set(DISCORD_STATE_COOKIE, `${state}|${next}|${link ? "link" : ""}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
