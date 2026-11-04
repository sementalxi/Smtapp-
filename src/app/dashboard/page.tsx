import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { thumb } from "@/lib/thumb";
import { reapStale } from "@/lib/banners";
import { getNumberSetting } from "@/lib/settings";
import { ART_TYPES } from "@/lib/pro-options";
import { visibleCategories } from "@/lib/categories";
import { AccountShell } from "@/components/account/AccountShell";
import { TypeIcon } from "@/components/wizard/TypeIcon";
import { DailyReward } from "@/components/DailyReward";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const es = locale === "es";
  await reapStale(user.id);

  const [banners, artCount, spent, cost, playerCards] = await Promise.all([
    db.banner.findMany({
      where: { userId: user.id },
      include: { template: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.banner.count({ where: { userId: user.id, status: "READY" } }),
    db.payment.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
    getNumberSetting("pro_cost"),
    db.banner.findMany({
      where: { userId: user.id, mode: "PRO", status: "READY", finalUrl: { not: null }, template: { layout: "PLAYER" } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, finalUrl: true },
    }),
  ]);
  const first = user.name.split(" ")[0];
  const subscribed = (!!user.subscriptionId || user.subscriptionStatus === "comp") && user.subscriptionStatus !== "canceled";

  return (
    <AccountShell user={user}>
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{es ? `¡Hola, ${first}!` : `Hello, ${first}!`}</h1>
          <p className="text-sm text-muted">{es ? "¿Qué quieres crear hoy?" : "What would you like to create today?"}</p>
        </div>
        <Link href="/create" className="btn-primary shrink-0 px-4 py-2.5 text-sm">＋ {es ? "Crear" : "Create"}</Link>
      </div>

      {!subscribed && (
        <Link
          href="/pricing"
          className="card mt-5 flex items-center gap-4 border-lime/40 bg-gradient-to-r from-lime/10 to-transparent p-4"
        >
          <div className="flex-1">
            <span className="chip border-lime bg-lime text-[10px] text-ink">{es ? "SUSCRÍBETE" : "SUBSCRIBE"}</span>
            <div className="mt-1 font-bold">{es ? "Más créditos cada mes" : "Fresh credits every month"}</div>
          </div>
          <span className="btn-primary px-4 py-2 text-xs">{es ? "Ver planes" : "See plans"} ›</span>
        </Link>
      )}

      <div className="card mt-4 grid grid-cols-3 divide-x divide-line">
        {[
          [es ? "Créditos" : "Credits", user.credits],
          [es ? "Artes" : "Arts", artCount],
          [es ? "Gastado" : "Spent", `$${((spent._sum.amountCents ?? 0) / 100).toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
            <div className="mt-1 text-xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <DailyReward variant="card" />
      </div>

      <div className="mt-7 mb-3 flex items-end justify-between">
        <h2 className="text-lg font-extrabold">{es ? "Crear nuevo arte" : "Create new art"}</h2>
        <span className="text-xs text-muted">⚡ {cost} {es ? "c/u" : "each"}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(await visibleCategories()).map((l) => ART_TYPES.find((a) => a.layout === l)!).filter(Boolean).map((a) => (
          <Link
            key={a.layout}
            href={`/create?type=${a.layout.toLowerCase()}`}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-panel px-1 py-3 text-center transition hover:border-lime/50 active:scale-95"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-lime/30 bg-lime/10 text-lime">
              <TypeIcon layout={a.layout} className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-bold leading-tight">{es ? a.es.name : a.en.name}</span>
          </Link>
        ))}
        <Link href="/create?team=1" className="flex flex-col items-center gap-1.5 rounded-2xl border border-teal/40 bg-gradient-to-b from-teal/10 to-panel px-1 py-3 text-center transition hover:border-teal/70 active:scale-95">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-teal/40 bg-teal/10 text-teal">
            <TypeIcon layout="TEAM" className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold leading-tight">{es ? "Tarjetas del equipo" : "Team cards"}</span>
        </Link>
        <Link href="/create/roster" className="flex flex-col items-center gap-1.5 rounded-2xl border border-lime/40 bg-gradient-to-b from-lime/10 to-panel px-1 py-3 text-center transition hover:border-lime/70 active:scale-95">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-lime/40 bg-lime/10 text-lime">
            <TypeIcon layout="RESULT" className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-bold leading-tight">{es ? "Banners de plantilla" : "Roster banners"}</span>
        </Link>
      </div>

      <div className="mt-8 mb-3 flex items-end justify-between">
        <h2 className="text-lg font-extrabold">{es ? "Recientes" : "Recent"}</h2>
        {banners.length > 0 && <Link href="/history" className="text-xs font-bold text-lime">{es ? "Ver todo" : "See all"} ›</Link>}
      </div>
      {banners.length ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {banners.slice(0, 10).map((b) => (
            <Link key={b.id} href={`/banner/${b.id}`} className="w-32 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-lime/50 sm:w-40">
              {b.status === "READY" && b.finalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(b.finalUrl, 320)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <span className="grid aspect-[4/5] w-full place-items-center text-xs text-muted">{b.status === "FAILED" ? t("failed") : t("processing")}</span>
              )}
              <span className="block truncate px-2 py-1.5 text-[11px] font-semibold">{b.title || b.template?.name || "KIXO"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/create" className="card block p-8 text-center text-sm text-muted">{t("dash_empty")} <span className="text-lime">＋ {t("new_banner")}</span></Link>
      )}

      {playerCards.length > 0 && (
        <>
          <div className="mt-8 mb-1">
            <h2 className="text-lg font-extrabold">{es ? "Haz el resto del equipo" : "Make the rest of the team"}</h2>
            <p className="text-xs text-muted">{es ? "Toca una tarjeta para hacer otra con el mismo diseño." : "Tap a card to make another with the same design."}</p>
          </div>
          <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {playerCards.map((b) => (
              <Link key={b.id} href={`/create?match=${b.id}`} className="w-24 shrink-0 snap-start overflow-hidden rounded-xl border border-line transition hover:border-teal/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(b.finalUrl!, 200)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                <span className="block bg-teal/10 px-1 py-1 text-center text-[10px] font-bold text-teal">＋ {es ? "Mismo" : "Same"}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
    </AccountShell>
  );
}
