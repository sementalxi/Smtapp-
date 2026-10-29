"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

/** Phone tab bar — the creator is one thumb-tap away from anywhere. */
export function BottomNav() {
  const path = usePathname() || "/";
  const { locale } = useT();
  const es = locale === "es";
  const tabs = [
    { href: "/dashboard", label: es ? "Inicio" : "Home", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
    { href: "/gallery", label: es ? "Mis artes" : "My art", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
    { href: "/create", label: es ? "Crear" : "Create", icon: "" },
    { href: "/pricing", label: es ? "Créditos" : "Credits", icon: "M13 2 4 14h7l-1 8 9-12h-7z" },
    { href: "/billing", label: es ? "Cuenta" : "Account", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label={es ? "Navegación" : "Navigation"}
    >
      <ul className="mx-auto flex max-w-md items-end justify-between px-3">
        {tabs.map((t) => {
          const active = path === t.href || (t.href !== "/dashboard" && path.startsWith(t.href));
          if (t.href === "/create") {
            return (
              <li key={t.href} className="-mt-6">
                <Link
                  href="/create"
                  aria-label={t.label}
                  className="cut flex h-16 w-16 flex-col items-center justify-center bg-gradient-to-b from-[#8fe9ff] via-lime to-lime-dim text-[#03111a] shadow-[0_0_24px_rgb(57_215_255/0.45)]"
                >
                  <span className="text-3xl leading-none font-black">+</span>
                  <span className="text-[10px] font-bold">{t.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex w-16 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-lime" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
