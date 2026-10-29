"use client";

import { createContext, useContext } from "react";
import { DICTS, Dict, Locale, format } from "./dict";

const Ctx = createContext<Locale>("es");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useT() {
  const locale = useContext(Ctx);
  const dict = DICTS[locale];
  const t = (key: keyof Dict, vars?: Record<string, string | number>) => format(dict[key], vars);
  return { t, locale };
}
