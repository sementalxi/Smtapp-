import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { loadPricing } from "@/lib/pricing";

const Money = z.coerce.number().min(0.5).max(9999);
const Count = z.coerce.number().int().min(1).max(100000);
const Schema = z.object({
  packs: z.array(z.object({ id: z.enum(["small", "medium", "large"]), credits: Count, priceUsd: Money, popular: z.boolean(), active: z.boolean().default(true) })),
  plans: z.array(z.object({ id: z.enum(["starter", "pro"]), monthlyCredits: Count, priceUsd: Money, popular: z.boolean(), active: z.boolean().default(true) })),
});

/** Admin: save credit pack and plan prices. */
export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Schema.parse(await req.json());
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
