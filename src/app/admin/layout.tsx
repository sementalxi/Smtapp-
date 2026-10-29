import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const { t } = await getT();
  const links = [
    ["/admin", t("admin_overview")],
    ["/admin/users", t("admin_users")],
    ["/admin/banners", t("admin_banners")],
    ["/admin/templates", t("admin_templates")],
    ["/admin/transactions", t("admin_tx")],
    ["/admin/payments", t("admin_payments")],
    ["/admin/settings", t("admin_settings")],
  ] as const;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[200px_1fr]">
      <aside>
        <div className="font-display mb-4 text-2xl text-lime">{t("admin_title")}</div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
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
