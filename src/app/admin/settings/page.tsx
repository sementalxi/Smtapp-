import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { CREDIT_PACKS, PLANS } from "@/lib/pricing";

export default async function AdminSettings() {
  await requireAdmin();
  const { t, locale } = await getT();
  const es = locale === "es";
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{t("admin_settings")}</h1>
      <SettingsForm initial={settings} />
      <div className="card max-w-xl p-6 text-sm text-muted">
        <h2 className="mb-2 font-bold text-white">{t("pricing_title")}</h2>
        <p className="mb-3">
          {es ? "Los precios están en " : "Prices are set in "}
          <code className="text-lime">src/lib/pricing.ts</code>
          {es
            ? ". Los productos en Stripe se crean solos con la primera compra (y otra vez si cambias un precio)."
            : ". The matching products in Stripe are created automatically on the first purchase (and again whenever you change a price)."}
        </p>
        <ul className="space-y-1">
          {CREDIT_PACKS.map((p) => (
            <li key={p.id}>
              {es ? "Paquete" : "Pack"} {p.id}: {p.credits} {es ? "créditos" : "credits"} · ${p.priceUsd}
            </li>
          ))}
          {PLANS.map((p) => (
            <li key={p.id}>
              Plan {p.id}: {p.monthlyCredits} {es ? "créditos/mes" : "credits/mo"} · ${p.priceUsd}{es ? "/mes" : "/mo"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
