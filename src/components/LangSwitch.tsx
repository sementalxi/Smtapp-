"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/dict";

export function LangSwitch({ locale }: { locale: Locale }) {
  const path = usePathname() || "/";
  const other: Locale = locale === "es" ? "en" : "es";
  return (
    <a
      href={`/api/locale?l=${other}&next=${encodeURIComponent(path)}`}
      className="chip py-1 text-muted hover:text-white"
      aria-label="Change language"
    >
      {other.toUpperCase()}
    </a>
  );
}
