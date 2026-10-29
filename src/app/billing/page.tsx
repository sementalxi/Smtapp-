import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { PricingCards } from "@/components/PricingCards";
import { BuyButton } from "@/components/BuyButton";
import { TxTable } from "@/components/TxTable";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const { success } = await searchParams;
  const tx = await db.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {success && (
        <>
          <p className="card mb-6 border-lime/50 p-4 text-sm text-lime">{t("payment_success")}</p>
          <AutoRefresh seconds={4} times={3} />
        </>
      )}

      <div className="card mb-12 flex flex-wrap items-center gap-6 p-6">
        <div>
          <div className="label">{t("balance")}</div>
          <div className="font-display text-6xl text-lime">{user.credits}</div>
        </div>
        {user.subscriptionId && (
          <div className="text-sm">
            <div className="label">{t("current_plan")}</div>
            <div className="font-bold uppercase">{user.planId ?? "—"}</div>
            <div className="text-muted">
              {t("status")}: {user.subscriptionStatus}
              {user.currentPeriodEnd && (
                <> · {t("renews")} {user.currentPeriodEnd.toLocaleDateString(locale)}</>
              )}
            </div>
          </div>
        )}
        {user.stripeCustomerId && process.env.STRIPE_SECRET_KEY && (
          <div className="ml-auto w-56">
            <BuyButton kind="portal" label={t("manage_billing")} loggedIn />
          </div>
        )}
      </div>

      <PricingCards user={user} />

      <h2 className="font-display mt-14 mb-4 text-3xl">{t("history")}</h2>
      <div className="card overflow-x-auto">
        {tx.length ? <TxTable rows={tx} locale={locale} /> : <p className="p-6 text-sm text-muted">{t("no_history")}</p>}
      </div>
    </div>
  );
}
