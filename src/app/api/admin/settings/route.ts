import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";

const Body = z.object({
  signup_credits: z.coerce.number().int().min(0).max(1000).optional(),
  pro_cost: z.coerce.number().int().min(0).max(100).optional(),
  pro_quality: z.enum(["low", "medium", "high"]).optional(),
  max_upload_mb: z.coerce.number().int().min(1).max(50).optional(),
  maintenance_message: z.string().max(300).optional(),
  discord_webhook: z
    .string()
    .trim()
    .max(300)
    .refine((u) => !u || /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(u), "Not a Discord webhook URL")
    .optional(),
});

export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Body.parse(await req.json());
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: String(value) }, update: { value: String(value) } });
  }
  return json({ ok: true });
});
