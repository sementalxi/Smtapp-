import { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { searchXbox, xboxSearchReady } from "@/lib/xbox";

/** Gamertag search (sign-up and Profile). Public — rate-limited per IP. */
export const GET = handle(async (req: NextRequest) => {
  if (!xboxSearchReady()) return json({ ready: false, results: [] });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 32);
  if (q.length < 2) return json({ ready: true, results: [] });
  rateLimit(req, "xbox_search", 30, 10 * 60_000);
  try {
    return json({ ready: true, results: await searchXbox(q) });
  } catch (e) {
    console.error("xbox search failed", e);
    return json({ ready: true, results: [], error: "search_failed" });
  }
});
