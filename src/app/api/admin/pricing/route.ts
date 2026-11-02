import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadPricing } from "@/lib/pricing";

const Money = z.coerce.number().min(0.5).max(9999);
const Count = z.coerce.number().int().min(1).max(100000);
const Schema = z.object({
  packs: z.array(z.object({ id: z.enum(["small", "medium", "large"]), credits: Count, priceUsd: Money, popular: z.boolean(), active: z.boolean().default(true) })),
  plans: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]{2,20}$/),
        name: z.string().trim().min(1).max(40),
        nameEs: z.string().trim().max(40).default(""),
        features: z.string().max(800).default(""),
        featuresEs: z.string().max(800).default(""),
        monthlyCredits: Count,
        priceUsd: Money,
        popular: z.boolean(),
        active: z.boolean().default(true),
        quality: z.enum(["low", "medium", "high"]).default("high"),
      }),
    )
    .max(12),
});

/** Admin: save credit pack and plan prices. */
export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Schema.parse(await req.json());
  if (new Set(body.plans.map((p) => p.id)).size !== body.plans.length) throw new HttpError(400, "duplicate_plan");
  // A plan with live subscribers can't be removed (their monthly credits would stop) — hide it instead.
  const before = await loadPricing();
  for (const old of before.plans) {
    if (body.plans.some((p) => p.id === old.id)) continue;
    const subs = await db.user.count({ where: { planId: old.id, subscriptionStatus: { in: ["active", "canceling", "pending", "past_due"] } } });
    if (subs > 0) return json({ error: "plan_has_subscribers", plan: old.name, count: subs }, 400);
  }
  const value = JSON.stringify(body);
  await db.setting.upsert({ where: { key: "pricing" }, create: { key: "pricing", value }, update: { value } });
  for (const p of ["/", "/pricing", "/billing"]) revalidatePath(p);
  return json({ pricing: await loadPricing() });
});

/** Admin: reset to the original prices. */
export const DELETE = handle(async () => {
  await apiAdmin();
  await db.setting.deleteMany({ where: { key: "pricing" } });
  for (const p of ["/", "/pricing", "/billing"]) revalidatePath(p);
  return json({ pricing: await loadPricing() });
});
