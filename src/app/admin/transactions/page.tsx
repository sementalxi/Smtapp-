import Link from "next/link";
import type { TxType } from "@prisma/client";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TxTable } from "@/components/TxTable";

const TYPES: TxType[] = ["SIGNUP_BONUS", "PURCHASE", "SUBSCRIPTION", "GENERATION", "REFUND", "ADMIN_ADJUST", "REFERRAL"];
const PER_PAGE = 50;

export default async function AdminTx({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const { type, page = "1" } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where = TYPES.includes(type as TxType) ? { type: type as TxType } : {};
  const [rows, total] = await Promise.all([
    db.creditTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: { id: true, email: true } }, admin: { select: { email: true } } },
    }),
    db.creditTransaction.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (n: number) => `?page=${n}${type ? `&type=${type}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{t("admin_tx")}</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/transactions" className={`chip ${!type ? "text-lime" : "text-muted"}`}>{t("all")}</Link>
        {TYPES.map((x) => (
          <Link key={x} href={`?type=${x}`} className={`chip ${type === x ? "text-lime" : "text-muted"}`}>
            {x.replace("_", " ")}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <TxTable rows={rows} locale={locale} showUser />
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {p > 1 && <Link href={qs(p - 1)} className="btn-ghost">←</Link>}
          <span className="text-muted">{p} / {pages}</span>
          {p < pages && <Link href={qs(p + 1)} className="btn-ghost">→</Link>}
        </div>
      )}
    </div>
  );
}
