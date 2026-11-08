import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { publicSet } from "@/lib/logo-maker";

export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const set = await db.logoSet.findFirst({ where: { id, userId: user.id } });
  if (!set) return json({ error: "not_found" }, 404);
  // a set stuck for more than 10 minutes failed (the function was stopped)
  if (set.status === "PROCESSING" && Date.now() - set.createdAt.getTime() > 10 * 60_000) {
    const opts = Array.isArray(set.options) ? set.options.filter(Boolean) : [];
    const upd = await db.logoSet.update({ where: { id }, data: { status: opts.length ? "READY" : "FAILED" } });
    return json({ set: publicSet(upd) });
  }
  return json({ set: publicSet(set) });
});
