import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { DICTS } from "@/i18n/dict";
import { TEXT_OVERRIDES_KEY } from "@/i18n/overrides";

const Map = z.record(z.string().max(60), z.string().max(2000));
const Body = z.object({ en: Map, es: Map });

// Admin: save custom site texts. Only keys that exist and differ from the default are kept.
export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Body.parse(await req.json());
  const clean = { en: {} as Record<string, string>, es: {} as Record<string, string> };
  for (const lang of ["en", "es"] as const) {
    const base = DICTS[lang] as Record<string, string>;
    for (const [k, v] of Object.entries(body[lang] as Record<string, string>)) {
      if (k in base && v.trim() && v !== base[k]) clean[lang][k] = v;
    }
  }
  const value = JSON.stringify(clean);
  await db.setting.upsert({ where: { key: TEXT_OVERRIDES_KEY }, create: { key: TEXT_OVERRIDES_KEY, value }, update: { value } });
  return json({ ok: true, saved: Object.keys(clean.en).length + Object.keys(clean.es).length });
});
