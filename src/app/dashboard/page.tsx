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

  const [banners, artCount, spent, cost] = await Promise.all([
    db.banner.findMany({
      where: { userId: user.id },
      include: { template: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.banner.count({ where: { userId: user.id, status: "READY" } }),
    db.payment.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
    getNumberSetting("pro_cost"),
  ]);
  const first = user.name.split(" ")[0];
  const subscribed = !!user.subscriptionId && user.subscriptionStatus !== "canceled";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display chrome text-5xl">
        {es ? `¡Hola, ${first}!` : `Hello, ${first}!`}
      </h1>
      <p className="mt-2 text-lg text-muted">{es ? "¿Qué quieres crear hoy?" : "What would you like to create today?"}</p>
      <Link href="/create" className="btn-primary mt-5 w-full py-4 text-base sm:w-auto sm:px-10">
        ＋ {es ? "Crear un póster" : "Create a poster"}
      </Link>

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
        <h2 className="font-display chrome text-3xl">{es ? "Crear nuevo arte" : "Create new art"}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ART_TYPES.map((a) => (
          <Link
            key={a.layout}
            href={`/create?type=${a.layout.toLowerCase()}`}
            className="card flex items-center gap-4 p-4 transition hover:border-lime/60"
          >
            <span className="cut grid h-14 w-14 shrink-0 place-items-center bg-panel-2 text-3xl">{a.icon}</span>
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
      </div>

      <div className="mt-12 mb-4 flex items-end justify-between">
        <h2 className="font-display chrome text-3xl">{es ? "Recientes" : "Recent"}</h2>
        <Link href="/gallery" className="text-sm font-semibold text-lime">{es ? "Ver todo" : "See all"}</Link>
      </div>
      {banners.length ? (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} />
      ) : (
        <div className="card p-10 text-center text-sm text-muted">{t("dash_empty")}</div>
      )}
    </div>
  );
}
