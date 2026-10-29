import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { PricingCards } from "@/components/PricingCards";

export const metadata = { title: "Pricing" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  const user = await getCurrentUser();
  const { t } = await getT();
  const { canceled } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-5xl">{t("pricing_title")}</h1>
      <p className="mt-2 mb-10 text-muted">{t("pricing_sub")}</p>
      {canceled && <p className="card mb-8 p-4 text-sm text-muted">{t("payment_cancel")}</p>}
      <PricingCards user={user} />
    </div>
  );
}
