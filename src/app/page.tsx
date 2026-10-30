import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { getNumberSetting, getSettings } from "@/lib/settings";
import { TemplateThumb } from "@/components/TemplateThumb";
import { PricingCards } from "@/components/PricingCards";
import { HomeHero } from "@/components/HomeHero";
import type { ClientTemplate } from "@/lib/samples";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const { t, locale } = await getT();
  let templates: ClientTemplate[] = [];
  let bonus = 3;
  let heroImgs: string[] = [];
  try {
    const st = await getSettings();
    heroImgs = [st.hero_1, st.hero_2, st.hero_3].filter(Boolean);
    templates = await activeTemplates();
    bonus = await getNumberSetting("signup_credits");
  } catch {
    /* DB not ready */
  }

  return (
    <div>
      <HomeHero t={t as never} user={!!user} bonus={bonus} heroImgs={heroImgs} templates={templates} />

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
