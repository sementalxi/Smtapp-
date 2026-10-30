import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getNumberSetting } from "@/lib/settings";
import { AccountNav, type AccountLink } from "./AccountNav";

/** Layout for the user's own pages: sidebar (desktop) / chip menu (phone) + content. */
export async function AccountShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const { locale } = await getT();
  const es = locale === "es";
  const reward = await getNumberSetting("referral_reward").catch(() => 0);
  const links: AccountLink[] = [
    { href: "/dashboard", label: es ? "Inicio" : "Home", icon: "home" },
    { href: "/create", label: es ? "Crear arte" : "Create art", icon: "create" },
    { href: "/history", label: es ? "Historial" : "History", icon: "history" },
    { href: "/credits", label: es ? "Créditos" : "Credits", icon: "credits" },
    { href: "/invite", label: es ? "Invita y gana" : "Invite & earn", icon: "invite", badge: reward > 0 ? `+${reward}` : undefined },
    { href: "/profile", label: es ? "Perfil" : "Profile", icon: "profile" },
  ];
  const initial = (user.name || user.email).trim()[0]?.toUpperCase() ?? "K";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8 lg:py-8">
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-4">
          <AccountNav links={links} variant="side" />
          <Link href="/credits" className="block overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-panel-2 to-panel p-4 transition hover:border-lime/50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{es ? "Tus créditos" : "Your credits"}</div>
            <div className="font-display mt-1 text-4xl text-lime">⚡ {user.credits}</div>
            <div className="mt-2 text-xs font-bold text-teal">{es ? "Conseguir más ›" : "Get more ›"}</div>
          </Link>
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:border-teal/50">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-extrabold text-ink">{initial}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user.name}</div>
              <div className="truncate text-[11px] text-muted">{user.email}</div>
            </div>
          </Link>
        </div>
      </aside>
      <div className="min-w-0 space-y-5">
        {children}
      </div>
    </div>
  );
}

/** Page title row used inside the account pages. */
export function AccountHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl tracking-wide">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Small stat tile. */
export function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/70 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className={`font-display mt-1 text-3xl tabular-nums ${accent ? "text-lime" : ""}`}>{value}</div>
    </div>
  );
}
