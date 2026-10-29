import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";

const PER_PAGE = 24;

export default async function AdminBanners({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  await requireAdmin();
  const { t } = await getT();
  const { page = "1", status } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  await reapStale();
  const where = status === "FAILED" ? { status: "FAILED" as const } : {};
  const [banners, total] = await Promise.all([
    db.banner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { template: true, user: { select: { id: true, email: true } } },
    }),
    db.banner.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (n: number) => `?page=${n}${status ? `&status=${status}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display chrome text-4xl">{t("admin_banners")}</h1>
        <span className="chip text-muted">{total}</span>
        <div className="ml-auto flex gap-2 text-sm">
          <Link href="/admin/banners" className={`chip ${!status ? "text-lime" : "text-muted"}`}>{t("all")}</Link>
          <Link href="/admin/banners?status=FAILED" className={`chip ${status ? "text-danger" : "text-muted"}`}>{t("failed")}</Link>
        </div>
      </div>
      <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} admin />
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
