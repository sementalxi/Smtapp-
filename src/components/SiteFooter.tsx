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
    <footer className="mt-24 border-t border-line bg-panel/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kixo-wordmark.png" alt={site} className="h-7 w-auto [filter:hue-rotate(246deg)]" />
          <p className="mt-3 max-w-xs text-sm text-muted">
            {es
              ? "Pósters de deportes y esports hechos con IA — tu foto, tu escudo, tus colores. Listos en minutos."
              : "AI-made sports & esports posters — your photo, your crest, your colours. Ready in minutes."}
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.3em] text-teal">Pro clubs · Esports · Football</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted">{c.title}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  {l.ext ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-white/85 hover:text-lime">{l.label} ↗</a>
                  ) : (
                    <Link href={l.href} className="text-white/85 hover:text-lime">{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/60 px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {site} · {es ? "Hecho para equipos que quieren verse pro." : "Made for teams that want to look pro."}
      </div>
    </footer>
  );
}
