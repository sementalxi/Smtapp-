import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TxTable } from "@/components/TxTable";
import { BannerGrid } from "@/components/BannerGrid";
import { CreditAdjust, UserFlags } from "@/components/admin/UserControls";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { t, locale } = await getT();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  const [tx, banners, payments] = await Promise.all([
    db.creditTransaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { admin: { select: { email: true } } },
    }),
    db.banner.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 12, include: { template: true } }),
    db.payment.aggregate({ where: { userId: id }, _sum: { amountCents: true }, _count: true }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-muted hover:text-white">← {t("admin_users")}</Link>

      <div className="card flex flex-wrap items-center gap-6 p-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user.email}</h1>
          <p className="text-sm text-muted">
            {user.name} · {t("joined")} {user.createdAt.toLocaleDateString(locale)}
            {user.planId && <> · {user.planId.toUpperCase()} ({user.subscriptionStatus})</>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {payments._count} payments · ${((payments._sum.amountCents ?? 0) / 100).toFixed(2)} total
            {user.stripeCustomerId && <> · Stripe {user.stripeCustomerId}</>}
          </p>
          <div className="mt-3">
            <UserFlags userId={user.id} role={user.role} banned={user.banned} self={user.id === me.id} />
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="label">{t("balance")}</div>
          <div className="font-display text-6xl text-lime">{user.credits}</div>
        </div>
      </div>

      <CreditAdjust userId={user.id} />

      <div className="card overflow-x-auto">
        <h2 className="p-4 font-bold">{t("history")}</h2>
        {tx.length ? <TxTable rows={tx} locale={locale} /> : <p className="px-4 pb-4 text-sm text-muted">{t("no_history")}</p>}
      </div>

      {banners.length > 0 && (
        <div>
          <h2 className="mb-3 font-bold">{t("admin_banners")}</h2>
          <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} admin />
        </div>
      )}
    </div>
  );
}
