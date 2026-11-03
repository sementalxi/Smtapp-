import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Newest log lines (after = only newer than this time, for live updates). */
export const GET = handle(async (req: NextRequest) => {
  await apiAdmin();
  const after = req.nextUrl.searchParams.get("after");
  const source = req.nextUrl.searchParams.get("source");
  const level = req.nextUrl.searchParams.get("level");
  const rows = await db.activityLog.findMany({
    where: {
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      ...(source === "site" || source === "bot" ? { source } : {}),
      ...(level === "error" ? { level: { in: ["error", "warn"] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: after ? 100 : 150,
  });
  return json({ rows: rows.map((r) => ({ id: r.id, source: r.source, level: r.level, kind: r.kind, message: r.message, at: r.createdAt.toISOString() })) });
});
