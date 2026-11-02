import { NextRequest, NextResponse } from "next/server";
import { discordAuthReady, discordRedirectUri, makeState } from "@/lib/discord-auth";
import { botReady, guildId } from "@/lib/discord-bot";

/** Sends the visitor to Discord to approve "KIXO wants to see your username and email". */
export async function GET(req: NextRequest) {
  if (!discordAuthReady()) return NextResponse.redirect(new URL("/register", req.url));
  let next = req.nextUrl.searchParams.get("next") || "";
  if (!next.startsWith("/") || next.startsWith("//")) next = "";
  const link = req.nextUrl.searchParams.get("link") === "1";
  if (link) next = "/profile";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID!.trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", discordRedirectUri(req));
  url.searchParams.set("scope", botReady() && guildId() ? "identify email guilds.join" : "identify email");
  url.searchParams.set("state", makeState(next, link));
  url.searchParams.set("prompt", link ? "consent" : "none");
  return NextResponse.redirect(url);
}
