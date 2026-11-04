import { CREDIT_PACKS, PLANS, loadPricing } from "@/lib/pricing";
import { getT } from "@/i18n/server";
import type { CurrentUser } from "@/lib/auth";
import { BuyButton } from "./BuyButton";
import { paymentProvider } from "@/lib/payments";

const usd = (n: number) => `$${n.toFixed(2)}`;

export async function PricingCards({ user }: { user: CurrentUser | null }) {
  await loadPricing();
  const { t } = await getT();
  const activePlan = user?.subscriptionId ? user.planId : null;
  const provider = paymentProvider();
  const off = !provider; // payments not set up yet
  const { locale } = await getT();
  const cancelLabel = locale === "es" ? "Cancelar suscripción" : "Cancel subscription";

  const shownPlans = PLANS.filter((p) => p.active !== false || activePlan === p.id);
  const shownPacks = CREDIT_PACKS.filter((p) => p.active !== false);

  return (
    <div className="space-y-14">
      <section className={shownPlans.length ? "" : "hidden"}>
        <h2 className="font-display text-3xl">{t("plans_title")}</h2>
        <p className="mb-5 text-sm text-muted">{t("plans_sub")}</p>
        <div className={`grid gap-4 ${shownPlans.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : shownPlans.length > 1 ? "sm:grid-cols-2" : "max-w-md"}`}>
          {shownPlans.map((p) => {
            const current = activePlan === p.id;
            return (
              <div
                key={p.id}
                className={`card relative p-6 ${p.popular ? "border-lime/60 shadow-[0_0_40px_-12px] shadow-lime/40" : ""}`}
              >
                {p.popular && (
                  <span className="chip absolute -top-3 right-5 border-lime bg-lime text-ink">{t("popular")}</span>
                )}
                <div className="text-sm font-bold uppercase tracking-wider text-muted">
                  {(locale === "es" ? p.nameEs || p.name : p.name) || p.id}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-5xl">{usd(p.priceUsd)}</span>
                  <span className="text-muted">{t("per_month")}</span>
                </div>
                <p className="mt-2 mb-6 text-sm">
                  <b className="text-lime">{p.monthlyCredits}</b> {t("credits_per_month")}
                  <span className="text-muted"> · ${(p.priceUsd / p.monthlyCredits).toFixed(2)}/{t("credit")}</span>
                </p>
                <p className="-mt-4 mb-6 text-xs font-bold text-teal">
                  {p.quality === "high" ? (locale === "es" ? "💎 IA Pro de máxima calidad" : "💎 Best-quality Pro AI") : p.quality === "low" ? (locale === "es" ? "⚡ IA Pro rápida" : "⚡ Fast Pro AI") : locale === "es" ? "✨ IA Pro estándar" : "✨ Standard Pro AI"}
                </p>
                {(() => {
                  const feats = ((locale === "es" ? p.featuresEs || p.features : p.features) ?? "").split("\n").map((x) => x.trim().replace(/^[^\p{L}\p{N}$#@]+/u, "").trim()).filter(Boolean);
                  return feats.length ? (
                    <ul className="-mt-3 mb-6 space-y-1.5 text-sm">
                      {feats.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span className="text-lime">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null;
                })()}
                {current && provider === "square" ? (
                  user?.subscriptionStatus === "canceling" ? (
                    <p className="text-center text-xs text-muted">{locale === "es" ? "Se cancela al final del mes pagado" : "Ends at the end of the paid month"}</p>
                  ) : (
                    <BuyButton kind="cancel" label={cancelLabel} loggedIn={!!user} />
                  )
                ) : current ? (
                  <BuyButton kind="portal" label={t("manage_billing")} loggedIn={!!user} />
                ) : (
                  <BuyButton kind="plan" id={p.id} label={t("subscribe")} loggedIn={!!user} primary={p.popular} disabled={off} checkout={{ title: `Plan ${(locale === "es" ? p.nameEs || p.name : p.name) || p.id}`, price: usd(p.priceUsd), subtitle: `${p.monthlyCredits} ${t("credits")} / ${locale === "es" ? "mes" : "month"}` }} />
                )}
                {current && <p className="mt-2 text-center text-xs text-lime">{t("current_plan")}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className={shownPacks.length ? "" : "hidden"}>
        <h2 className="font-display text-3xl">{t("packs_title")}</h2>
        <p className="mb-5 text-sm text-muted">{t("packs_sub")}</p>
        <div className={`grid gap-4 ${shownPacks.length >= 3 ? "sm:grid-cols-3" : shownPacks.length === 2 ? "sm:grid-cols-2" : "max-w-md"}`}>
          {shownPacks.map((p) => (
            <div key={p.id} className={`card relative p-6 ${p.popular ? "border-lime/60" : ""}`}>
              {p.popular && (
                <span className="chip absolute -top-3 right-5 border-lime bg-lime text-ink">{t("popular")}</span>
              )}
              <div className="text-sm font-bold uppercase tracking-wider text-muted">
                {t(p.id === "small" ? "pack_small" : p.id === "medium" ? "pack_medium" : "pack_large")}
              </div>
              <div className="font-display mt-2 text-5xl text-lime">{p.credits}</div>
              <div className="mb-6 text-sm text-muted">
                {t("credits")} · {usd(p.priceUsd)}
              </div>
              <BuyButton kind="pack" id={p.id} label={`${t("buy")} ${usd(p.priceUsd)}`} loggedIn={!!user} primary={p.popular} disabled={off} checkout={{ title: `${p.credits} ${t("credits")}`, price: usd(p.priceUsd), subtitle: locale === "es" ? "Pago único" : "One-time purchase" }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
