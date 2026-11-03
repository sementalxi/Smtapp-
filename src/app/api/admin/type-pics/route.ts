import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { TYPE_PIC_KEYS } from "@/lib/type-pics";

const Body = z.object({ pics: z.record(z.string(), z.string().max(500)) });

export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { pics } = Body.parse(await req.json());
  const clean = Object.fromEntries(Object.entries(pics).filter(([k, u]) => (TYPE_PIC_KEYS as readonly string[]).includes(k) && /^(https:\/\/|\/)/.test(String(u))));
  const value = JSON.stringify(clean);
  await db.setting.upsert({ where: { key: "type_pics" }, create: { key: "type_pics", value }, update: { value } });
  return json({ ok: true });
});
