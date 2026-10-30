import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { TxTable } from "@/components/TxTable";
import { getNumberSetting } from "@/lib/settings";
import { AccountHeader, AccountShell, StatTile } from "@/components/account/AccountShell";

export const metadata = { title: "Credits" };

export default async function CreditsPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const es = locale === "es";
  const [received, used, arts, tx, cost] = await Promise.all([
    db.creditTransaction.aggregate({ where: { userId: user.id, amount: { gt: 0 }, type: { not: "REFUND" } }, _sum: { amount: true } }),
    db.creditTransaction.aggregate({ where: { userId: user.id, amount: { lt: 0 } }, _sum: { amount: true } }),
    db.banner.count({ where: { userId: user.id, status: "READY" } }),
    db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 }),
    getNumberSetting("pro_cost"),
  ]);
  const refunds = await db.creditTransaction.aggregate({ where: { userId: user.id, type: "REFUND" }, _sum: { amount: true } });
  const usedNet = Math.max(0, -(used._sum.amount ?? 0) - (refunds._sum.amount ?? 0));
  const subscribed = !!user.subscriptionId && user.subscriptionStatus !== "canceled";

  return (
    <AccountShell user={user}>
      <AccountHeader title={es ? "Créditos" : "Credits"} sub={es ? "Tu saldo y todo tu historial de créditos" : "Your balance and full credit history"} action={<Link href="/pricing" className="btn-primary px-4 py-2 text-sm">⚡ {es ? "Comprar créditos" : "Get credits"}</Link>} />

      <div className="relative overflow-hidden rounded-2xl border border-lime/40 bg-gradient-to-br from-lime/15 via-panel to-panel p-6">
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-lime/20 blur-3xl" />
        <div className="text-[11px] font-bold uppercase tracking-widest text-teal">{es ? "Saldo actual" : "Current balance"}</div>
        <div className="font-display mt-1 text-7xl text-lime">{user.credits}</div>
        <div className="text-sm text-muted">
          {es ? "créditos disponibles" : "credits available"} · ≈ {cost > 0 ? Math.floor(user.credits / cost) : "∞"} {es ? "pósters Pro" : "Pro posters"}
        </div>
        {subscribed && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
            ✓ Plan {String(user.planId ?? "").toUpperCase()}
            {user.currentPeriodEnd ? ` · ${es ? "renueva" : "renews"} ${user.currentPeriodEnd.toLocaleDateString(locale)}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={es ? "Recibidos" : "Received"} value={received._sum.amount ?? 0} />
        <StatTile label={es ? "Usados" : "Used"} value={usedNet} />
        <StatTile label={es ? "Artes" : "Arts"} value={arts} />
      </div>

      {!subscribed && (
        <Link href="/pricing" className="flex items-center gap-4 rounded-2xl border border-teal/40 bg-gradient-to-r from-teal/10 to-transparent p-4 transition hover:border-teal">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal/50 text-xl text-teal">↻</span>
          <span className="flex-1">
            <span className="block font-bold">{es ? "Suscríbete y recibe créditos cada mes" : "Subscribe for fresh credits every month"}</span>
            <span className="block text-xs text-muted">{es ? "Elige un plan y los créditos se agregan solos." : "Pick a plan and credits are added automatically."}</span>
          </span>
          <span className="text-teal">›</span>
        </Link>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold">{t("history")}</h2>
        <div className="card overflow-x-auto">{tx.length ? <TxTable rows={tx} locale={locale} /> : <p className="p-6 text-sm text-muted">{t("no_history")}</p>}</div>
      </div>
    </AccountShell>
  );
}
