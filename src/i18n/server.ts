import { cookies, headers } from "next/headers";
import { DICTS, Dict, Locale, format } from "./dict";

export const LOCALE_COOKIE = "bf_lang";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === "es" || c === "en") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("en") ? "en" : "es";
}

export async function getT() {
  const locale = await getLocale();
  const dict: Dict = DICTS[locale];
  const t = (key: keyof Dict, vars?: Record<string, string | number>) => format(dict[key], vars);
  return { t, locale, dict };
}
