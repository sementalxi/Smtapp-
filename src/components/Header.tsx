import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { LangSwitch } from "./LangSwitch";
import { NavLinks } from "./NavLinks";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

export async function Header() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();
  const items = [
    ...(user
      ? [
          { href: "/create", label: t("nav_create"), icon: "create" as const },
          { href: "/dashboard", label: t("nav_dashboard"), icon: "home" as const },
        ]
      : []),
    { href: "/pricing", label: t("nav_pricing"), icon: "pricing" as const },
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t("nav_admin"), icon: "admin" as const, admin: true }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label={site}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kixo-logo.png" alt={site} className="h-5 w-auto min-[400px]:h-6 sm:h-8" />
        </Link>

        <NavLinks variant="desktop" items={items} />

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
              <Link href="/login" className="btn-ghost shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3">{t("nav_login")}</Link>
              <Link href="/register" className="btn-primary shrink-0 whitespace-nowrap px-2 py-1.5 text-xs sm:px-3">{t("nav_register")}</Link>
            </>
          )}
        </div>
      </div>
      {user && <NavLinks variant="mobile" items={items} />}
    </header>
  );
}
