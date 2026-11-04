// Saved league tables: each user keeps one table per league/organization, so next time they pick
// the league the table is already filled and they only update it.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";

const key = (userId: string, league: string) => `standings:${userId}:${league}`;
const Row = z.object({ team: z.string().max(30), p: z.string().max(4), w: z.string().max(4), d: z.string().max(4), l: z.string().max(4), gd: z.string().max(5), pts: z.string().max(5) });
const Body = z.object({ league: z.string().min(1).max(40), rows: z.array(Row).max(20), headline: z.string().max(30).optional(), date: z.string().max(30).optional() });

export const GET = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const league = req.nextUrl.searchParams.get("league") ?? "";
  if (!league) return json({ table: null });
  const row = await db.setting.findUnique({ where: { key: key(user.id, league) } });
  try {
    return json({ table: row ? JSON.parse(row.value) : null });
  } catch {
    return json({ table: null });
  }
});

export const PUT = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const b = Body.parse(await req.json());
  const rows = b.rows.filter((r) => r.team.trim());
  const value = JSON.stringify({ rows, headline: b.headline ?? "", date: b.date ?? "", savedAt: new Date().toISOString() });
  await db.setting.upsert({ where: { key: key(user.id, b.league) }, create: { key: key(user.id, b.league), value }, update: { value } });
  return json({ ok: true });
});

export const DELETE = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const league = req.nextUrl.searchParams.get("league") ?? "";
  if (league) await db.setting.deleteMany({ where: { key: key(user.id, league) } });
  return json({ ok: true });
});
