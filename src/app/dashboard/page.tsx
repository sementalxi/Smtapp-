import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";

export const metadata = { title: "My banners" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { t } = await getT();
  await reapStale(user.id);
  const banners = await db.banner.findMany({
    where: { userId: user.id },
    include: { template: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <h1 className="font-display text-5xl">{t("dash_title")}</h1>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/billing" className="btn-ghost">⚡ {user.credits} {t("credits")}</Link>
          <Link href="/create" className="btn-primary">＋ {t("new_banner")}</Link>
        </div>
      </div>

      {banners.length ? (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} />
      ) : (
        <div className="card p-12 text-center">
          <p className="mb-6 text-muted">{t("dash_empty")}</p>
          <Link href="/create" className="btn-primary">{t("hero_cta")}</Link>
        </div>
      )}
    </div>
  );
}
