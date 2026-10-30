import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { GiftEveryone, UserQuick } from "@/components/admin/UserQuick";

const PER_PAGE = 24;
const FILTERS = ["all", "active", "subs", "admins", "empty", "banned"] as const;
const SORTS = ["new", "credits", "posters"] as const;

const ago = (d: Date, es: boolean) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 60) return es ? `hace ${Math.max(1, m)} min` : `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return es ? `hace ${h} h` : `${h}h ago`;
  const days = Math.round(h / 24);
  return es ? `hace ${days} d` : `${days}d ago`;
};

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; f?: string; sort?: string }>;
}) {
  const me = await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const sp = await searchParams;
  const q = sp.q ?? "";
  const f = (FILTERS as readonly string[]).includes(sp.f ?? "") ? (sp.f as (typeof FILTERS)[number]) : "all";
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "new";
  const p = Math.max(1, Number(sp.page) || 1);
  const week = new Date(Date.now() - 7 * 864e5);
  const day = new Date(Date.now() - 864e5);

  const filterWhere: Record<(typeof FILTERS)[number], Prisma.UserWhereInput> = {
    all: {},
    active: { banners: { some: { createdAt: { gte: week } } } },
    subs: { subscriptionId: { not: null }, NOT: { subscriptionStatus: "canceled" } },
    admins: { role: "ADMIN" },
    empty: { credits: 0 },
    banned: { banned: true },
  };
  const where: Prisma.UserWhereInput = {
    AND: [
      q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      filterWhere[f],
    ],
  };
  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "credits" ? { credits: "desc" } : sort === "posters" ? { banners: { _count: "desc" } } : { createdAt: "desc" };

  const [users, total, allUsers, newWeek, activeToday, creditsOut, postersToday, activeCount] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (p - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        _count: { select: { banners: true } },
        banners: { where: { status: "READY", finalUrl: { not: null } }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, finalUrl: true, createdAt: true } },
      },
    }),
    db.user.count({ where }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: week } } }),
    db.user.count({ where: { banners: { some: { createdAt: { gte: day } } } } }),
    db.user.aggregate({ _sum: { credits: true } }),
    db.banner.count({ where: { createdAt: { gte: day }, status: "READY" } }),
    db.user.count({ where: { banned: false } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (o: Record<string, string | number>) => {
    const params = new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { f } : {}), ...(sort !== "new" ? { sort } : {}) });
    for (const [k, v] of Object.entries(o)) {
      if (v === "" || (k === "f" && v === "all") || (k === "sort" && v === "new") || (k === "page" && v === 1)) params.delete(k);
      else params.set(k, String(v));
    }
    if (!("page" in o)) params.delete("page");
    const s = params.toString();
    return s ? `?${s}` : "?";
  };

  const L = {
    title: es ? "Usuarios" : "Users",
    stats: [
      [es ? "Usuarios" : "Users", allUsers],
      [es ? "Nuevos (7 días)" : "New (7 days)", newWeek],
      [es ? "Activos hoy" : "Active today", activeToday],
      [es ? "Pósters hoy" : "Posters today", postersToday],
      [es ? "Créditos en cuentas" : "Credits in accounts", creditsOut._sum.credits ?? 0],
    ] as const,
    filters: {
      all: es ? "Todos" : "All",
      active: es ? "Activos 7d" : "Active 7d",
      subs: es ? "Suscriptores" : "Subscribers",
      admins: "Admins",
      empty: es ? "Sin créditos" : "No credits",
      banned: es ? "Suspendidos" : "Suspended",
    },
    sorts: { new: es ? "Más nuevos" : "Newest", credits: es ? "Más créditos" : "Most credits", posters: es ? "Más pósters" : "Most posters" },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl">{L.title}</h1>
        <form className="ml-auto w-full sm:w-72">
          {f !== "all" && <input type="hidden" name="f" value={f} />}
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          <input name="q" defaultValue={q} placeholder={es ? "🔍 Buscar nombre o email…" : "🔍 Search name or email…"} className="input" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {L.stats.map(([label, value]) => (
          <div key={label} className="card p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
            <div className="mt-0.5 text-2xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      <GiftEveryone count={activeCount} />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((k) => (
          <Link key={k} href={qs({ f: k })} className={`chip ${f === k ? "border-lime bg-lime text-ink" : "text-muted hover:text-white"}`}>
            {L.filters[k]}
          </Link>
        ))}
        <span className="ml-auto flex gap-1 text-xs">
          {SORTS.map((k) => (
            <Link key={k} href={qs({ sort: k })} className={`rounded-md px-2 py-1 ${sort === k ? "bg-panel-2 font-bold text-white" : "text-muted"}`}>
              {L.sorts[k]}
            </Link>
          ))}
        </span>
      </div>

      {users.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">{es ? "Nadie coincide con esa búsqueda." : "No one matches that search."}</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {users.map((u) => {
            const last = u.banners[0]?.createdAt;
            const subbed = !!u.subscriptionId && u.subscriptionStatus !== "canceled";
            return (
              <div key={u.id} className={`card p-4 ${u.banned ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lime/40 to-panel-2 text-lg font-extrabold uppercase"
                  >
                    {(u.name || u.email)[0]}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-bold hover:text-lime">
                      {u.name || "—"}
                    </Link>
                    <div className="truncate text-xs text-muted">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {u.role === "ADMIN" && <span className="chip border-lime/50 py-0 text-[10px] text-lime">ADMIN</span>}
                      {subbed && <span className="chip border-amber-300/50 py-0 text-[10px] text-amber-200">{(u.planId ?? "plan").toUpperCase()}</span>}
                      {u.banned && <span className="chip border-danger/50 py-0 text-[10px] text-danger">{es ? "SUSPENDIDO" : "SUSPENDED"}</span>}
                      {u.createdAt >= week && <span className="chip border-sky-300/40 py-0 text-[10px] text-sky-200">{es ? "NUEVO" : "NEW"}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-muted">
                    <div>
                      🖼️ {u._count.banners} {es ? "pósters" : "posters"}
                    </div>
                    <div>{last ? ago(last, es) : es ? "sin pósters" : "no posters"}</div>
                  </div>
                </div>

                {u.banners.length > 0 && (
                  <div className="mt-3 flex gap-1.5">
                    {u.banners.map((b) => (
                      <Link key={b.id} href={`/admin/banners`} className="block w-12 overflow-hidden rounded-md border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.finalUrl!} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                      </Link>
                    ))}
                  </div>
                )}

                <div className="mt-3 border-t border-line pt-3">
                  <UserQuick userId={u.id} credits={u.credits} role={u.role} banned={u.banned} self={u.id === me.id} />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted">
                  <span>
                    {es ? "Se unió" : "Joined"} {u.createdAt.toLocaleDateString(locale)}
                  </span>
                  <Link href={`/admin/users/${u.id}`} className="text-lime hover:text-white">
                    {es ? "Ver historial" : "History"} ›
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {p > 1 && <Link href={qs({ page: p - 1 })} className="btn-ghost">←</Link>}
          <span className="text-muted">
            {p} / {pages}
          </span>
          {p < pages && <Link href={qs({ page: p + 1 })} className="btn-ghost">→</Link>}
        </div>
      )}
    </div>
  );
}
