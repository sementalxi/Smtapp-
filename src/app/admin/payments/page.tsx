import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPayments() {
  await requireAdmin();
  const { t, locale } = await getT();
  const rows = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, email: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display chrome text-4xl">{t("admin_payments")}</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("user")}</th>
              <th>{t("type")}</th>
              <th className="text-right">$</th>
              <th className="text-right">{t("credits")}</th>
              <th>Stripe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{r.createdAt.toLocaleString(locale)}</td>
                <td>
                  <Link href={`/admin/users/${r.user.id}`} className="hover:text-lime">{r.user.email}</Link>
                </td>
                <td className="text-xs uppercase">{r.kind} · {r.productId}</td>
                <td className="text-right font-bold">
                  {(r.amountCents / 100).toFixed(2)} {r.currency.toUpperCase()}
                </td>
                <td className="text-right text-lime">+{r.credits}</td>
                <td className="font-mono text-xs text-muted">{r.stripeRef}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-sm text-muted">{t("no_history")}</p>}
      </div>
    </div>
  );
}
