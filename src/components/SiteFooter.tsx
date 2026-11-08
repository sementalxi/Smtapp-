import Link from "next/link";
import { getLocale } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

/** Site footer: quick links, community and the brand line. */
export async function SiteFooter({ site }: { site: string }) {
  const locale = await getLocale();
  const es = locale === "es";
  const user = await getCurrentUser().catch(() => null);
  const st = await getSettings().catch(() => null);
  const discord = st?.discord_server || "";
  const cols: { title: string; links: { href: string; label: string; ext?: boolean }[] }[] = [
    {
      title: es ? "Crear" : "Create",
      links: user
        ? [
            { href: "/create", label: es ? "Nuevo póster" : "New poster" },
            { href: "/create?team=1", label: es ? "Tarjetas del equipo" : "Team cards" },
            { href: "/teams", label: es ? "Mis equipos" : "My teams" },
            { href: "/history", label: es ? "Historial" : "History" },
          ]
        : [
            { href: "/register", label: es ? "Crear mi póster" : "Create my poster" },
            { href: "/#styles", label: es ? "Explorar estilos" : "Explore styles" },
            { href: "/register", label: es ? "Créditos gratis" : "Free credits" },
            { href: "/login", label: es ? "Entrar" : "Log in" },
          ],
    },
    {
      title: es ? "Ayuda" : "Help",
      links: [
        { href: "/pricing", label: es ? "Precios y créditos" : "Pricing & credits" },
        ...(user ? [{ href: "/invite", label: es ? "Invita y gana" : "Invite & earn" }, { href: "#support", label: es ? "Soporte en vivo" : "Live support" }] : []),
        ...(discord ? [{ href: discord, label: es ? "Únete al Discord" : "Join the Discord", ext: true }] : []),
      ],
    },
  ];
  return (
    <footer className="mt-8 border-t border-line/60 sm:mt-14">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-5 text-[12px] text-muted">
        <span className="font-semibold text-white/70">© {new Date().getFullYear()} {site}</span>
        {cols.flatMap((c) => c.links).slice(0, 6).map((l) =>
          l.ext ? (
            <a key={l.href + l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-lime">{l.label} ↗</a>
          ) : (
            <Link key={l.href + l.label} href={l.href} className="hover:text-lime">{l.label}</Link>
          ),
        )}
        <Link href="/terms" className="hover:text-lime">{es ? "Términos" : "Terms"}</Link>
        <Link href="/privacy" className="hover:text-lime">{es ? "Privacidad" : "Privacy"}</Link>
        <Link href="/refunds" className="hover:text-lime">{es ? "Reembolsos" : "Refunds"}</Link>
      </div>
    </footer>
  );
}
