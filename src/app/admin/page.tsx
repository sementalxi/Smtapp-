import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TxTable } from "@/components/TxTable";
import { aiConfigured } from "@/lib/banners";
import { webhookSecret } from "@/lib/stripe";
import { ConnectStripeButton } from "@/components/admin/ConnectStripeButton";

export default async function AdminHome() {
  await requireAdmin();
  const { t, locale } = await getT();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [users, banners, revenue, subs, gens, credits, recentTx, newUsers, failed] = await Promise.all([
    db.user.count(),
    db.banner.count(),
    db.payment.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountCents: true } }),
    db.user.count({ where: { subscriptionStatus: { in: ["active", "trialing", "canceling"] } } }),
    db.creditTransaction.count({ where: { type: "GENERATION", createdAt: { gte: since } } }),
    db.user.aggregate({ _sum: { credits: true } }),
    db.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { id: true, email: true } }, admin: { select: { email: true } } },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, email: true, credits: true, createdAt: true } }),
    db.banner.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
  ]);

  const stats = [
    [t("stat_users"), users],
    [t("stat_banners"), banners],
    [t("stat_revenue"), `$${((revenue._sum.amountCents ?? 0) / 100).toFixed(2)}`],
    [t("stat_subs"), subs],
    [t("stat_gens"), gens],
    [t("stat_credits"), credits._sum.credits ?? 0],
  ] as const;

  const hasStripe = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhook = hasStripe && !!(await webhookSecret());
  const warnings = [
    !aiConfigured() && "AI is not configured (REPLICATE_API_TOKEN / OPENAI_API_KEY) — generations run in free demo mode.",
    !process.env.STRIPE_SECRET_KEY && "Payments are off (no STRIPE_SECRET_KEY). Buy buttons show “Coming soon”; you can still add credits to users here.",
    hasStripe && !hasWebhook && "Stripe webhook isn't connected yet — click “Connect Stripe” below, or paid credits won't be delivered.",
    process.env.STORAGE_DRIVER !== "s3" &&
      !process.env.BLOB_READ_WRITE_TOKEN &&
      process.env.NODE_ENV === "production" &&
      "No file storage connected — in Vercel open Storage → Create → Blob and connect it to this project, then redeploy.",
    failed > 0 && `${failed} failed generation(s) in the last 30 days — see Banners for errors.`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">{t("admin_overview")}</h1>

      {warnings.length > 0 && (
        <ul className="card space-y-1 border-amber-400/40 p-4 text-sm text-amber-200">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {hasStripe && !hasWebhook && <ConnectStripeButton />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="label">{label}</div>
            <div className="font-display text-4xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-bold">{t("admin_tx")}</h2>
            <Link href="/admin/transactions" className="text-xs text-lime">{t("all")} →</Link>
          </div>
          <TxTable rows={recentTx} locale={locale} showUser />
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t("admin_users")}</h2>
            <Link href="/admin/users" className="text-xs text-lime">{t("all")} →</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {newUsers.map((u) => (
              <li key={u.id} className="flex justify-between gap-2">
                <Link href={`/admin/users/${u.id}`} className="truncate hover:text-lime">{u.email}</Link>
                <span className="text-muted">⚡{u.credits}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
