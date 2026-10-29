import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";

export const metadata = { title: "My art" };

export default async function GalleryPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const es = locale === "es";
  await reapStale(user.id);
  const banners = await db.banner.findMany({
    where: { userId: user.id },
    include: { template: true },
    orderBy: { createdAt: "desc" },
    take: 90,
  });
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h1 className="font-display chrome text-5xl">{es ? "Mis artes" : "My art"}</h1>
        <Link href="/create" className="btn-primary hidden sm:inline-flex">＋ {t("new_banner")}</Link>
      </div>
      {banners.length ? (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} />
      ) : (
        <div className="card p-10 text-center">
          <p className="mb-5 text-muted">{es ? "Todavía no tienes artes. Crea el primero en un par de minutos." : "No art yet. Make your first one in a couple of minutes."}</p>
          <Link href="/create" className="btn-primary">{es ? "Crear mi primer póster" : "Create my first poster"}</Link>
        </div>
      )}
    </div>
  );
}
