import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadPricing } from "@/lib/pricing";
import { setCompPlan } from "@/lib/comp-plan";

/** Admin: give a user a free plan for N months, or remove it. */
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await params;
  const b = z.object({ planId: z.string().max(20).nullable(), months: z.coerce.number().int().min(1).max(36).default(1) }).parse(await req.json());
  const u = await db.user.findUnique({ where: { id }, select: { subscriptionId: true, subscriptionStatus: true } });
  if (!u) return json({ error: "not_found" }, 404);
  // Don't fight a real paid subscription.
  if (u.subscriptionId && ["active", "canceling", "pending", "past_due"].includes(u.subscriptionStatus ?? "")) return json({ error: "paying" }, 400);
  if (b.planId && !(await loadPricing()).plans.some((p) => p.id === b.planId)) return json({ error: "bad_plan" }, 400);
  await setCompPlan(id, b.planId, b.months);
  return json({ ok: true });
});
