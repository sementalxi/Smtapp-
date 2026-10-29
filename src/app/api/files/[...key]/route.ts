import { NextRequest, NextResponse } from "next/server";
import { readDbFile, readLocalFile } from "@/lib/storage";

// Serves images saved in the database (production fallback) or the local folder (development).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  try {
    if (key[0] === "db" && key[1]) {
      const f = await readDbFile(key[1]);
      if (!f) return new NextResponse("Not found", { status: 404 });
      return new NextResponse(new Uint8Array(f.data), {
        headers: { "Content-Type": f.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      });
    }
    const path = key.join("/");
    const data = await readLocalFile(path);
    const type = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
