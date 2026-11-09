import { NextRequest } from "next/server";
import { isXboxPic } from "@/lib/xbox";

/** Shows an Xbox gamerpic through KIXO (Xbox's image server won't load in other sites' pages). */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  if (!isXboxPic(u)) return new Response("bad", { status: 400 });
  try {
    const r = await fetch(u, { headers: { Accept: "image/*" }, signal: AbortSignal.timeout(10_000) });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !type.startsWith("image/")) return new Response("not found", { status: 404 });
    return new Response(await r.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
