import { cache } from "react";
import { db } from "@/lib/db";
import type { Locale } from "./dict";

export type TextOverrides = Record<Locale, Record<string, string>>;
export const TEXT_OVERRIDES_KEY = "text_overrides";

/** Admin-edited site texts (Admin → Texts), loaded once per request. */
export const getTextOverrides = cache(async (): Promise<TextOverrides> => {
  try {
    const row = await db.setting.findUnique({ where: { key: TEXT_OVERRIDES_KEY } });
    const v = row ? (JSON.parse(row.value) as Partial<TextOverrides>) : {};
    return { en: v.en ?? {}, es: v.es ?? {} };
  } catch {
    return { en: {}, es: {} };
  }
});
