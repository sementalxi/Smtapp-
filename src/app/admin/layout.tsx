import { requireAdmin, rolesForAdminPath, type Role } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { AdminNav, type AdminGroup } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const { t, locale } = await getT();
  const es = locale === "es";
  const groups: AdminGroup[] = [
    { title: es ? "Inicio" : "Home", links: [{ href: "/admin", label: t("admin_overview"), icon: "📊" }, { href: "/admin/logs", label: es ? "Registro en vivo" : "Live log", icon: "🟢" }] },
    {
      title: es ? "Crear y contenido" : "Create & content",
      links: [
        { href: "/admin/studio", label: es ? "Estudio libre" : "Free studio", icon: "🎨" },
        { href: "/admin/templates", label: es ? "Estilos" : "Styles", icon: "🖼️" },
        { href: "/admin/style-test", label: es ? "Probar estilos" : "Style test", icon: "🧪" },
        { href: "/admin/leagues", label: es ? "Ligas y logos" : "Leagues & logos", icon: "🛡️" },
        { href: "/admin/deals", label: es ? "Ofertas" : "Deals", icon: "🔥" },
        { href: "/admin/texts", label: es ? "Textos del sitio" : "Site texts", icon: "✏️" },
      ],
    },
    {
      title: es ? "Usuarios" : "People",
      links: [
        { href: "/admin/users", label: t("admin_users"), icon: "👥" },
        { href: "/admin/banners", label: es ? "Pósters creados" : "Posters made", icon: "🧾" },
        { href: "/admin/email", label: es ? "Email" : "Email", icon: "✉️" },
        { href: "/admin/discord", label: "Discord", icon: "💬" },
        { href: "/admin/bot", label: es ? "Bot de Discord" : "Discord bot", icon: "🤖" },
      ],
    },
    {
      title: es ? "Dinero" : "Money",
      links: [
        { href: "/admin/payments", label: es ? "Pagos" : "Payments", icon: "💳" },
        { href: "/admin/paylinks", label: es ? "Enlaces de pago" : "Payment links", icon: "🔗" },
        { href: "/admin/transactions", label: t("admin_tx"), icon: "📜" },
        { href: "/admin/daily", label: es ? "Recompensa diaria" : "Daily reward", icon: "🎁" },
      ],
    },
    { title: es ? "Sistema" : "System", links: [{ href: "/admin/settings", label: t("admin_settings"), icon: "⚙️" }] },
  ];

  // Staff and support only see the parts of the panel they may open.
  const visible = groups.map((g) => ({ ...g, links: g.links.filter((l) => rolesForAdminPath(l.href).includes(me.role as Role)) })).filter((g) => g.links.length > 0);
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 [grid-template-columns:minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 md:py-8">
      <aside className="sticky top-16 z-20 min-w-0 md:static md:top-auto">
        <div className="font-display mb-5 hidden text-2xl text-lime md:block">{t("admin_title")}</div>
        <AdminNav groups={visible} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
