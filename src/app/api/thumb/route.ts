import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isStorageUrl, loadBytes } from "@/lib/storage";

// Small, fast WebP previews of our own images (galleries, style pickers, history).
// Cached by the browser and Vercel's CDN for a year — the source files never change.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const w = Math.min(1200, Math.max(120, Number(req.nextUrl.searchParams.get("w")) || 480));
  if (!u || !isStorageUrl(u)) return new NextResponse("bad url", { status: 400 });
  try {
    const src = await loadBytes(u);
    const out = await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    return new NextResponse(new Uint8Array(out), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
    });
  } catch {
    return NextResponse.redirect(new URL(u, req.url));
  }
}
