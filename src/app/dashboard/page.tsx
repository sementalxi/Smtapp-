import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { thumb } from "@/lib/thumb";
import { reapStale } from "@/lib/banners";
import { getNumberSetting } from "@/lib/settings";
import { ART_TYPES } from "@/lib/pro-options";
import { visibleCategories } from "@/lib/categories";
import { ClaimLeagueButton } from "@/components/ClaimLeagueButton";
import { dailyStatus } from "@/lib/daily";
import { AccountShell } from "@/components/account/AccountShell";
import { TypeIcon } from "@/components/wizard/TypeIcon";
import { DailyReward } from "@/components/DailyReward";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const es = locale === "es";
  await reapStale(user.id);

  const [banners, artCount, cost, cats, daily] = await Promise.all([
    db.banner.findMany({
      where: { userId: user.id },
      include: { template: { select: { name: true, nameEs: true, layout: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.banner.count({ where: { userId: user.id, status: "READY" } }),
    getNumberSetting("pro_cost"),
    visibleCategories(user),
    dailyStatus(user.id, locale).catch(() => null),
  ]);
  const first = user.name.split(" ")[0];
  const initial = (first[0] ?? "K").toUpperCase();
  const subscribed = (!!user.subscriptionId || user.subscriptionStatus === "comp") && user.subscriptionStatus !== "canceled";
  const types = cats.map((l) => ART_TYPES.find((a) => a.layout === l)!).filter(Boolean);
  const latest = banners.find((b) => b.status === "READY" && b.finalUrl)?.finalUrl ?? null;
  const streak = daily?.streak ?? 0;

  return (
    <AccountShell user={user}>
      <div className="space-y-6">
        {/* Hero: greeting, credits and the main actions, over the user's latest poster */}
        <section className="relative overflow-hidden rounded-3xl border border-line bg-panel">
          {latest ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(latest, 640)} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover object-top opacity-30 blur-xl" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,46,136,0.28),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(47,216,232,0.18),transparent_50%)]" aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-ink/90" aria-hidden />
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime font-display text-xl text-ink shadow-[0_0_24px_-6px_rgba(255,46,136,0.9)]">{initial}</span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-2xl sm:text-3xl">{es ? `Hola, ${first}` : `Hey, ${first}`}</h1>
                <p className="text-xs text-muted sm:text-sm">{es ? "¿Qué vas a crear hoy?" : "What are you making today?"}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link href="/credits" className="rounded-2xl border border-lime/30 bg-ink/50 p-3 backdrop-blur transition hover:border-lime/70">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{es ? "Créditos" : "Credits"}</div>
                <div className="font-display mt-0.5 text-2xl text-lime">⚡ {user.credits}</div>
                <div className="mt-0.5 text-[10px] font-bold text-lime/80">{es ? "Conseguir más ›" : "Get more ›"}</div>
              </Link>
              <Link href="/history" className="rounded-2xl border border-line bg-ink/50 p-3 backdrop-blur transition hover:border-lime/50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{es ? "Artes" : "Arts"}</div>
                <div className="font-display mt-0.5 text-2xl">{artCount}</div>
                <div className="mt-0.5 text-[10px] font-bold text-muted">{es ? "Historial ›" : "History ›"}</div>
              </Link>
              <div className="rounded-2xl border border-line bg-ink/50 p-3 backdrop-blur">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{es ? "Racha" : "Streak"}</div>
                <div className="font-display mt-0.5 text-2xl">🔥 {streak}</div>
                <div className="mt-0.5 text-[10px] font-bold text-muted">{streak ? (es ? "días seguidos" : "days in a row") : es ? "reclama hoy" : "claim today"}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <Link href="/create" className="btn-primary py-3 text-base">＋ {es ? "Crear un póster" : "Create a poster"}</Link>
              <Link href="/create?team=1" className="btn-ghost px-4 py-3 text-sm">
                <TypeIcon layout="TEAM" className="h-4 w-4 text-teal" /> {es ? "Equipo" : "Team"}
              </Link>
            </div>
          </div>
        </section>

        <DailyReward variant="card" />

        {!subscribed && (
          <Link href="/pricing" className="flex items-center gap-3 rounded-2xl border border-lime/30 bg-gradient-to-r from-lime/10 to-transparent px-4 py-3 transition hover:border-lime/60">
            <span className="text-xl">💎</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{es ? "Más créditos cada mes" : "Fresh credits every month"}</span>
              <span className="block truncate text-xs text-muted">{es ? "Planes mensuales con créditos incluidos" : "Monthly plans with credits included"}</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-lime">{es ? "Ver planes ›" : "See plans ›"}</span>
          </Link>
        )}

        {/* Create new art */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl">{es ? "Crear nuevo arte" : "Create new art"}</h2>
            <span className="chip text-[11px] text-muted">⚡ {cost} {es ? "c/u" : "each"}</span>
          </div>
          {/* flex-wrap so the last row stretches — no empty holes */}
          <div className="flex flex-wrap gap-2">
            {types.map((a) => (
              <Link
                key={a.layout}
                href={`/create?type=${a.layout.toLowerCase()}`}
                className="group flex min-w-0 flex-1 basis-[30%] flex-col items-center gap-1.5 rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-panel px-2 py-3.5 text-center transition hover:border-lime/60 active:scale-95"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-lime/30 bg-lime/10 text-lime transition group-hover:bg-lime/20">
                  <TypeIcon layout={a.layout} className="h-5 w-5" />
                </span>
                <span className="text-[12px] font-bold leading-tight">{es ? a.es.name : a.en.name}</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href="/create?team=1" className="flex items-center gap-3 rounded-2xl border border-teal/40 bg-gradient-to-br from-teal/15 to-panel p-3 transition hover:border-teal/80 active:scale-[0.98]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-teal/40 bg-teal/10 text-teal">
                <TypeIcon layout="TEAM" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold leading-tight">{es ? "Tarjetas del equipo" : "Team cards"}</span>
                <span className="block text-[10px] leading-tight text-muted">{es ? "Mismo diseño para todos" : "One design, whole squad"}</span>
              </span>
            </Link>
            <Link href="/create/roster" className="flex items-center gap-3 rounded-2xl border border-lime/40 bg-gradient-to-br from-lime/15 to-panel p-3 transition hover:border-lime/80 active:scale-[0.98]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lime/40 bg-lime/10 text-lime">
                <TypeIcon layout="RESULT" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold leading-tight">{es ? "Banners de plantilla" : "Roster banners"}</span>
                <span className="block text-[10px] leading-tight text-muted">{es ? "Un banner por jugador" : "One banner per player"}</span>
              </span>
            </Link>
          </div>
        </section>

        {/* Organizations / league admins: standings kept on the site */}
        {user.isOrg || user.role === "ADMIN" || user.role === "STAFF" || (await db.savedItem.count({ where: { userId: user.id, kind: "championship" } }).catch(() => 0)) > 0 ? (
          <Link href="/leagues" className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 transition hover:border-teal/60">
            <span className="text-xl">🏟️</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{es ? "Tus ligas" : "Your leagues"}</span>
              <span className="block truncate text-xs text-muted">{es ? "Guarda tu tabla aquí: toca G / E / P tras cada jornada y genera el póster." : "Keep your standings here: tap W / D / L after each matchday and generate the poster."}</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-teal">{es ? "Mis ligas ›" : "My leagues ›"}</span>
          </Link>
        ) : (
          <ClaimLeagueButton es={es} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-left transition hover:border-teal/60">
            <span className="text-xl">🏟️</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{es ? "¿Organizas una liga?" : "Run a league?"}</span>
              <span className="block truncate text-xs text-muted">{es ? "Pide el rol de liga en soporte y desbloquea tablas, ligas y pósters de liga." : "Claim the league role in support to unlock standings, leagues and league posters."}</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-teal">{es ? "Reclamar rol ›" : "Claim role ›"}</span>
          </ClaimLeagueButton>
        )}

        {/* Recent posters */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl">{es ? "Recientes" : "Recent"}</h2>
              {banners.some((b) => b.template.layout === "PLAYER" && b.status === "READY") && (
                <p className="text-[11px] text-muted">{es ? "“＋ Mismo” hace otro jugador con ese diseño." : "“＋ Same” makes another player in that design."}</p>
              )}
            </div>
            {banners.length > 0 && <Link href="/history" className="text-xs font-bold text-lime">{es ? "Ver todo" : "See all"} ›</Link>}
          </div>
          {banners.length ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {banners.map((b) => {
                const ready = b.status === "READY" && !!b.finalUrl;
                const same = ready && b.template.layout === "PLAYER" && b.mode === "PRO";
                return (
                  <div key={b.id} className="relative overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-lime/50">
                    <Link href={`/banner/${b.id}`} className="block">
                      {ready ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb(b.finalUrl!, 320)} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                      ) : (
                        <span className="grid aspect-[4/5] w-full place-items-center px-2 text-center text-[11px] text-muted">{b.status === "FAILED" ? t("failed") : t("processing")}</span>
                      )}
                      <span className="block truncate px-2 pt-1.5 text-[11px] font-bold">{b.title || b.template.name || "KIXO"}</span>
                      <span className="block truncate px-2 pb-1.5 text-[10px] text-muted">{es ? b.template.nameEs || b.template.name : b.template.name}</span>
                    </Link>
                    {same && (
                      <Link href={`/create?match=${b.id}`} className="absolute right-1.5 top-1.5 rounded-full border border-teal/60 bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-teal backdrop-blur transition hover:bg-teal hover:text-ink">
                        ＋ {es ? "Mismo" : "Same"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <Link href="/create" className="card block p-8 text-center text-sm text-muted">
              {t("dash_empty")} <span className="text-lime">＋ {t("new_banner")}</span>
            </Link>
          )}
        </section>
      </div>
    </AccountShell>
  );
}
