import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const links = [
    ["/admin", t("admin_overview")],
    ["/admin/users", t("admin_users")],
    ["/admin/banners", t("admin_banners")],
    ["/admin/templates", t("admin_templates")],
    ["/admin/leagues", locale === "es" ? "Ligas y logos" : "Leagues & logos"],
    ["/admin/texts", locale === "es" ? "Textos del sitio" : "Site texts"],
    ["/admin/deals", locale === "es" ? "Ofertas" : "Deals"],
    ["/admin/transactions", t("admin_tx")],
    ["/admin/payments", t("admin_payments")],
    ["/admin/settings", t("admin_settings")],
  ] as const;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 md:py-8">
      <aside className="min-w-0">
        <div className="font-display mb-4 text-2xl text-lime">{t("admin_title")}</div>
        <nav className="-mx-4 flex max-w-[100vw] gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:max-w-none md:flex-col md:px-0">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-panel-2 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
