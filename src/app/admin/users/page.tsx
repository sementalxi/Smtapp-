import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";

const PER_PAGE = 30;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const { q = "", page = "1" } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { banners: true } } },
    }),
    db.user.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (n: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl">{t("admin_users")}</h1>
        <span className="chip text-muted">{total}</span>
        <form className="ml-auto w-full max-w-xs">
          <input name="q" defaultValue={q} placeholder={t("search_users")} className="input" />
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t("email")}</th>
              <th>{t("name")}</th>
              <th className="text-right">{t("credits")}</th>
              <th>{t("current_plan")}</th>
              <th className="text-right">{t("admin_banners")}</th>
              <th>{t("role")}</th>
              <th>{t("joined")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.banned ? "opacity-50" : ""}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="font-semibold hover:text-lime">{u.email}</Link>
                </td>
                <td className="text-muted">{u.name}</td>
                <td className="text-right font-bold text-lime">{u.credits}</td>
                <td className="text-xs uppercase">{u.planId ? `${u.planId} · ${u.subscriptionStatus}` : "—"}</td>
                <td className="text-right">{u._count.banners}</td>
                <td>
                  <span className={`chip ${u.role === "ADMIN" ? "border-lime/50 text-lime" : "text-muted"}`}>{u.role}</span>
                  {u.banned && <span className="chip ml-1 border-danger/50 text-danger">BANNED</span>}
                </td>
                <td className="whitespace-nowrap text-muted">{u.createdAt.toLocaleDateString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {p > 1 && <Link href={qs(p - 1)} className="btn-ghost">←</Link>}
          <span className="text-muted">
            {p} / {pages}
          </span>
          {p < pages && <Link href={qs(p + 1)} className="btn-ghost">→</Link>}
        </div>
      )}
    </div>
  );
}
