import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";

const PER_PAGE = 24;

export default async function AdminBanners({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const es = locale === "es";
  const { page = "1", status } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  await reapStale();
  const videosTab = status === "VIDEOS";
  const where = status === "FAILED" ? { status: "FAILED" as const } : {};
  const [videos, videoCount] = await Promise.all([
    videosTab ? db.videoJob.findMany({ orderBy: { createdAt: "desc" }, skip: (p - 1) * PER_PAGE, take: PER_PAGE }) : Promise.resolve([]),
    db.videoJob.count(),
  ]);
  const vUsers = videosTab ? await db.user.findMany({ where: { id: { in: [...new Set(videos.map((v) => v.userId))] } }, select: { id: true, email: true } }) : [];
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
  const pages = Math.max(1, Math.ceil((videosTab ? videoCount : total) / PER_PAGE));
  const qs = (n: number) => `?page=${n}${status ? `&status=${status}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-4xl">{t("admin_banners")}</h1>
        <span className="chip text-muted">{videosTab ? videoCount : total}</span>
        <div className="ml-auto flex flex-wrap justify-end gap-2 text-sm">
          <Link href="/admin/banners" className={`chip ${!status ? "text-lime" : "text-muted"}`}>{t("all")}</Link>
          <Link href="/admin/banners?status=VIDEOS" className={`chip ${videosTab ? "text-fuchsia-300" : "text-muted"}`}>✨ {es ? "Videos IA" : "AI videos"} {videoCount ? `· ${videoCount}` : ""}</Link>
          <Link href="/admin/banners?status=FAILED" className={`chip ${status === "FAILED" ? "text-danger" : "text-muted"}`}>{t("failed")}</Link>
        </div>
      </div>
      {videosTab ? (
        videos.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">{es ? "Aún no hay videos con IA." : "No AI videos yet."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {videos.map((v) => {
              const email = vUsers.find((u) => u.id === v.userId)?.email ?? "?";
              return (
                <div key={v.id} className="overflow-hidden rounded-2xl border border-line bg-panel">
                  {v.status === "done" && v.videoUrl ? (
                    <video src={v.videoUrl} controls playsInline loop muted preload="metadata" className="aspect-[4/5] w-full bg-ink object-cover" />
                  ) : (
                    <div className={`grid aspect-[4/5] place-items-center p-3 text-center text-xs ${v.status === "failed" ? "text-danger" : "text-fuchsia-300"}`}>
                      {v.status === "failed" ? `❌ ${es ? "Falló" : "Failed"}${v.error ? ` — ${v.error.slice(0, 120)}` : ""}` : `⏳ ${es ? "Creando…" : "Making…"}`}
                    </div>
                  )}
                  <div className="space-y-0.5 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>✨ {v.seconds}s{v.audio ? " · 🔊" : ""}</span>
                      <span className="text-lime">⚡{v.cost}</span>
                    </div>
                    <Link href={`/admin/users/${v.userId}`} className="block truncate text-muted hover:text-lime">{email}</Link>
                    <details className="text-[10px]">
                      <summary className="cursor-pointer font-bold text-fuchsia-300">{es ? "Ver lo que se le pidió a la IA" : "See what the AI was asked"}</summary>
                      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-2 text-muted">{`[${v.model}]\n\n${v.prompt}`}</pre>
                    </details>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
                      <span>{v.createdAt.toLocaleString(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      {v.bannerId && <Link href={`/banner/${v.bannerId}`} className="font-bold text-lime">{es ? "Póster" : "Poster"} →</Link>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} admin />
      )}
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
