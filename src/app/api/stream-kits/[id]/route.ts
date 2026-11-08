import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import type { StreamItem } from "@/lib/stream-kit";

export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const kit = await db.streamKit.findFirst({ where: { id, userId: user.id } });
  if (!kit) return json({ error: "not_found" }, 404);
  // a kit stuck for more than 15 minutes is finished (the function was stopped): unfinished pieces count as failed
  if (kit.status === "PROCESSING" && Date.now() - kit.createdAt.getTime() > 15 * 60_000) {
    const items = (kit.items as unknown as StreamItem[]).map((x) => (x.status === "ready" ? x : { ...x, status: "failed" as const }));
    const upd = await db.streamKit.update({ where: { id }, data: { items: items as never, status: "DONE" } });
    return json({ kit: { id, status: upd.status, items: upd.items, inputs: upd.inputs } });
  }
  return json({ kit: { id, status: kit.status, items: kit.items, inputs: kit.inputs } });
});
