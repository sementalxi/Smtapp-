import { NextRequest } from "next/server";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { imageSearchProvider, searchImages } from "@/lib/image-search";

// GET /api/image-search?q=messi&kind=photo → { provider, results: [{thumb,url,title,source}] }
export const GET = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "image-search", 60, 60 * 60_000, user.id);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) throw new HttpError(400, "query_too_short");
  const kind = req.nextUrl.searchParams.get("kind") === "logo" ? "logo" : "photo";
  try {
    return json({ provider: imageSearchProvider(), results: await searchImages(q, kind) });
  } catch (e) {
    console.error("image search failed", e);
    return json({ error: "search_failed" }, 502);
  }
});
