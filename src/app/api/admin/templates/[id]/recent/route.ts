import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { thumb } from "@/lib/thumb";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: the latest finished posters made with a style (any user) — to see what the AI produced with it. */
export const GET = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const rows = await db.banner.findMany({
    where: { templateId: id, status: "READY", finalUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, finalUrl: true, title: true, createdAt: true, design: true },
  });
  return json({
    posters: rows.map((b) => ({
      id: b.id,
      url: thumb(b.finalUrl!, 480),
      title: b.title,
      at: b.createdAt.toISOString(),
      test: !!(b.design as { styleTest?: string } | null)?.styleTest,
    })),
  });
});
