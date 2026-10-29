import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";
import { getNumberSetting } from "@/lib/settings";
import { ART_TYPES } from "@/lib/pro-options";

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
      take: 24,
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
  const subscribed = !!user.subscriptionId && user.subscriptionStatus !== "canceled";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">
        {es ? `¡Hola, ${first}!` : `Hello, ${first}!`}
      </h1>
      <p className="mt-1 text-muted">{es ? "¿Qué quieres crear hoy?" : "What would you like to create today?"}</p>

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

      <div className="card mt-5 grid grid-cols-3 divide-x divide-line">
        {[
          [es ? "Créditos" : "Credits", user.credits],
          [es ? "Artes" : "Arts", artCount],
          [es ? "Gastado" : "Spent", `$${((spent._sum.amountCents ?? 0) / 100).toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</div>
            <div className="mt-1 text-xl font-extrabold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 mb-4 flex items-end justify-between">
        <h2 className="text-xl font-extrabold">{es ? "Crear nuevo arte" : "Create new art"}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ART_TYPES.map((a) => (
          <Link
            key={a.layout}
            href={`/create?type=${a.layout.toLowerCase()}`}
            className="card flex items-center gap-4 p-4 transition hover:border-lime/60"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-panel-2 text-3xl">{a.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{es ? a.es.name : a.en.name}</span>
              <span className="line-clamp-2 block text-xs text-muted">{es ? a.es.desc : a.en.desc}</span>
              <span className="mt-1 block text-xs text-lime">
                {cost} {t("credits")}
              </span>
            </span>
            <span className="text-muted">›</span>
          </Link>
        ))}
        <Link href="/create?team=1" className="card flex items-center gap-4 p-4 transition hover:border-lime/60">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-panel-2 text-3xl">👥</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{es ? "Tarjetas del equipo" : "Team player cards"}</span>
            <span className="line-clamp-2 block text-xs text-muted">
              {es ? "Toda la plantilla con el mismo diseño." : "The whole squad in the same design."}
            </span>
            <span className="mt-1 block text-xs text-lime">{cost} {t("credits")}</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      </div>

      <div className="mt-10 mb-4">
        <h2 className="text-xl font-extrabold">👥 {es ? "Tarjetas para todo el equipo" : "Cards for the whole team"}</h2>
        <p className="text-sm text-muted">
          {es
            ? "Haz una tarjeta de jugador y luego crea las del resto del equipo con el mismo diseño — solo cambias foto, nombre y número."
            : "Make one player card, then make the rest of the team with the same design — just change the photo, name and number."}
        </p>
      </div>
      {playerCards.length ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {playerCards.map((b) => (
            <Link key={b.id} href={`/create?match=${b.id}`} className="card group w-36 shrink-0 overflow-hidden transition hover:border-lime/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.finalUrl!} alt="" className="aspect-[4/5] w-full object-cover" />
              <span className="block px-2 py-2 text-center text-xs font-bold text-lime">＋ {es ? "Mismo diseño" : "Same design"}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Link href="/create?type=player" className="card flex items-center gap-4 p-4 transition hover:border-lime/60">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-panel-2 text-3xl">👥</span>
          <span className="flex-1">
            <span className="block font-bold">{es ? "Empieza con la primera tarjeta" : "Start with the first card"}</span>
            <span className="block text-xs text-muted">{es ? "Después toca \"Siguiente jugador — mismo diseño\"." : "Then tap \"Next player — same design\"."}</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      )}

      <div className="mt-12 mb-4 flex items-end justify-between">
        <h2 className="text-xl font-extrabold">{t("dash_title")}</h2>
        <Link href="/create" className="text-sm text-lime">＋ {t("new_banner")}</Link>
      </div>
      {banners.length ? (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} />
      ) : (
        <div className="card p-10 text-center text-sm text-muted">{t("dash_empty")}</div>
      )}
    </div>
  );
}
