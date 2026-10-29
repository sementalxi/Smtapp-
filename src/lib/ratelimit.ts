import type { NextRequest } from "next/server";
import { HttpError } from "./auth";

// Simple in-memory limiter. It is per server instance, which is enough to slow
// down brute-force attempts; use Redis/Upstash if you need a global limit.
const hits = new Map<string, number[]>();

export function rateLimit(req: NextRequest, bucket: string, max: number, windowMs: number, key?: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const id = `${bucket}:${key ?? ip}`;
  const now = Date.now();
  const list = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, "too_many_requests");
  list.push(now);
  hits.set(id, list);
  if (hits.size > 10_000) hits.clear();
}
