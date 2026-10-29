import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { getNumberSetting } from "@/lib/settings";
import { TemplateThumb } from "@/components/TemplateThumb";
import { PricingCards } from "@/components/PricingCards";
import type { ClientTemplate } from "@/lib/samples";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();
  let templates: ClientTemplate[] = [];
  let bonus = 3;
  try {
    templates = await activeTemplates();
    bonus = await getNumberSetting("signup_credits");
  } catch {
    /* DB not ready */
  }
  const hero = templates.slice(0, 3);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-lime/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-lime">{t("hero_kicker")}</p>
            <h1 className="font-display text-6xl leading-[0.95] sm:text-7xl">{t("hero_title")}</h1>
            <p className="mt-6 max-w-lg text-lg text-muted">{t("hero_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/create" : "/register"} className="btn-primary px-6 py-3 text-base">
                ⚡ {t("hero_cta")}
              </Link>
              <Link href="/pricing" className="btn-ghost px-6 py-3 text-base">{t("hero_cta2")}</Link>
            </div>
            {bonus > 0 && <p className="mt-4 text-sm text-muted">{t("free_note", { n: bonus })}</p>}
          </div>

          <div className="relative h-[460px] sm:h-[540px]">
            {hero.map((tpl, i) => (
              <div
                key={tpl.id}
                className="absolute w-[56%] overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/60"
                style={{
                  left: `${i * 22}%`,
                  top: `${[8, 0, 14][i]}%`,
                  transform: `rotate(${[-7, 0, 7][i]}deg)`,
                  zIndex: i === 1 ? 3 : 1,
                }}
              >
                <TemplateThumb template={tpl} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display mb-8 text-4xl">{t("how_title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <div key={n} className="card p-5">
              <div className="font-display text-4xl text-lime">0{n}</div>
              <div className="mt-2 font-bold">{t(`how_${n}_t`)}</div>
              <p className="mt-1 text-sm text-muted">{t(`how_${n}_d`)}</p>
            </div>
          ))}
        </div>
      </section>

      {templates.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="font-display mb-8 text-4xl">{t("styles_title")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {templates.map((tpl) => (
              <Link
                key={tpl.id}
                href={user ? `/create?t=${tpl.slug}` : "/register"}
                className="group overflow-hidden rounded-xl border border-line transition hover:border-lime"
              >
                <TemplateThumb template={tpl} />
                <div className="bg-panel px-3 py-2 text-sm font-bold group-hover:text-lime">
                  {locale === "es" ? tpl.nameEs : tpl.name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-display text-5xl">{t("pricing_title")}</h2>
        <p className="mt-2 mb-10 text-muted">{t("pricing_sub")}</p>
        <PricingCards user={user} />
      </section>
    </div>
  );
}
