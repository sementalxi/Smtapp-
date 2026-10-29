import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { LangSwitch } from "./LangSwitch";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();
  const es = locale === "es";

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href={user ? "/dashboard" : "/"} className="flex shrink-0 items-center" aria-label={site}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kixo-logo.png" alt={site} className="h-6 w-auto sm:h-7" />
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-[15px] font-semibold text-muted md:flex">
          {user && (
            <>
              <Link href="/dashboard" className="hover:text-white">{t("nav_dashboard")}</Link>
              <Link href="/create" className="hover:text-white">{t("nav_create")}</Link>
            </>
          )}
          <Link href="/pricing" className="hover:text-white">{t("nav_pricing")}</Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-lime hover:text-white">{t("nav_admin")}</Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LangSwitch locale={locale} />
          {user ? (
            <>
              <Link
                href="/billing"
                className="flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-sm font-bold text-lime"
                title={t("balance")}
              >
                <span aria-hidden>⚡</span>
                {user.credits}
                <span className="hidden sm:inline">{user.credits === 1 ? t("credit") : t("credits")}</span>
              </Link>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-lime md:hidden">
                  {t("nav_admin")}
                </Link>
              )}
              <form action="/api/auth/logout" method="post" className="hidden md:block">
                <button className="px-2 text-sm text-muted hover:text-white">{t("nav_logout")}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 text-sm font-semibold text-muted hover:text-white">{t("nav_login")}</Link>
              <Link href="/register" className="btn-primary px-4 py-2 text-sm">{es ? "Empezar gratis" : "Start free"}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
