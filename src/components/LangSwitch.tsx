"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/dict";

/** EN | ES toggle — the current language is highlighted. */
export function LangSwitch({ locale }: { locale: Locale }) {
  const path = usePathname() || "/";
  return (
    <div className="flex overflow-hidden rounded-full border border-line text-xs font-bold" role="group" aria-label="Language">
      {(["en", "es"] as const).map((l) => (
        <a
          key={l}
          href={`/api/locale?l=${l}&next=${encodeURIComponent(path)}`}
          aria-current={l === locale ? "true" : undefined}
          className={`px-2.5 py-1 ${l === locale ? "bg-lime text-ink" : "text-muted hover:text-white"}`}
        >
          {l.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
