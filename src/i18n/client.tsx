"use client";

import { createContext, useContext } from "react";
import { DICTS, Dict, Locale, format } from "./dict";

const Ctx = createContext<{ locale: Locale; custom: Record<string, string> }>({ locale: "es", custom: {} });

export function I18nProvider({ locale, custom = {}, children }: { locale: Locale; custom?: Record<string, string>; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, custom }}>{children}</Ctx.Provider>;
}

export function useT() {
  const { locale, custom } = useContext(Ctx);
  const dict = { ...DICTS[locale], ...custom } as Dict;
  const t = (key: keyof Dict, vars?: Record<string, string | number>) => format(dict[key], vars);
  return { t, locale };
}
