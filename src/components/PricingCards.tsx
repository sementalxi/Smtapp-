import { CREDIT_PACKS, PLANS } from "@/lib/pricing";
import { getT } from "@/i18n/server";
import type { CurrentUser } from "@/lib/auth";
import { BuyButton } from "./BuyButton";
import { paymentProvider } from "@/lib/payments";

const usd = (n: number) => `$${n.toFixed(2)}`;

export async function PricingCards({ user }: { user: CurrentUser | null }) {
  const { t } = await getT();
  const activePlan = user?.subscriptionId ? user.planId : null;
  const provider = paymentProvider();
  const off = !provider; // payments not set up yet
  const { locale } = await getT();
  const cancelLabel = locale === "es" ? "Cancelar suscripción" : "Cancel subscription";

  return (
    <div className="space-y-14">
      <section>
        <h2 className="font-display text-3xl">{t("plans_title")}</h2>
        <p className="mb-5 text-sm text-muted">{t("plans_sub")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
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
                  {t(p.id === "pro" ? "plan_pro" : "plan_starter")}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-5xl">{usd(p.priceUsd)}</span>
                  <span className="text-muted">{t("per_month")}</span>
                </div>
                <p className="mt-2 mb-6 text-sm">
                  <b className="text-lime">{p.monthlyCredits}</b> {t("credits_per_month")}
                  <span className="text-muted"> · ${(p.priceUsd / p.monthlyCredits).toFixed(2)}/{t("credit")}</span>
                </p>
                {current && provider === "square" ? (
                  user?.subscriptionStatus === "canceling" ? (
                    <p className="text-center text-xs text-muted">{locale === "es" ? "Se cancela al final del mes pagado" : "Ends at the end of the paid month"}</p>
                  ) : (
                    <BuyButton kind="cancel" label={cancelLabel} loggedIn={!!user} />
                  )
                ) : current ? (
                  <BuyButton kind="portal" label={t("manage_billing")} loggedIn={!!user} />
                ) : (
                  <BuyButton kind="plan" id={p.id} label={t("subscribe")} loggedIn={!!user} primary={p.popular} disabled={off} />
                )}
                {current && <p className="mt-2 text-center text-xs text-lime">{t("current_plan")}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl">{t("packs_title")}</h2>
        <p className="mb-5 text-sm text-muted">{t("packs_sub")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
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
              <BuyButton kind="pack" id={p.id} label={`${t("buy")} ${usd(p.priceUsd)}`} loggedIn={!!user} primary={p.popular} disabled={off} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
