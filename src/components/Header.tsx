import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { LangSwitch } from "./LangSwitch";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label={site}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kixo-logo.png" alt={site} className="h-6 w-auto sm:h-8" />
        </Link>

        <nav className="ml-4 hidden items-center gap-5 text-sm font-semibold text-muted md:flex">
          {user && (
            <>
              <Link href="/create" className="hover:text-white">{t("nav_create")}</Link>
              <Link href="/dashboard" className="hover:text-white">{t("nav_dashboard")}</Link>
            </>
          )}
          <Link href="/pricing" className="hover:text-white">{t("nav_pricing")}</Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-lime hover:text-white">{t("nav_admin")}</Link>
          )}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <LangSwitch locale={locale} />
          {user ? (
            <>
              <Link href="/billing" className="chip whitespace-nowrap border-lime/40 bg-lime/10 py-1 text-lime" title={t("balance")}>
                ⚡ {user.credits}
                <span className="hidden sm:inline"> {user.credits === 1 ? t("credit") : t("credits")}</span>
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="btn-ghost whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-3" aria-label={t("nav_logout")}>
                  <span className="sm:hidden">⏻</span>
                  <span className="hidden sm:inline">{t("nav_logout")}</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-3">{t("nav_login")}</Link>
              <Link href="/register" className="btn-primary whitespace-nowrap px-2.5 py-1.5 text-xs sm:px-3">{t("nav_register")}</Link>
            </>
          )}
        </div>
      </div>
      {user && (
        <nav className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 text-sm font-semibold text-muted md:hidden">
          <Link href="/create">{t("nav_create")}</Link>
          <Link href="/dashboard">{t("nav_dashboard")}</Link>
          <Link href="/pricing">{t("nav_pricing")}</Link>
          {user.role === "ADMIN" && <Link href="/admin" className="text-lime">{t("nav_admin")}</Link>}
        </nav>
      )}
    </header>
  );
}
