import Link from "next/link";
import type { Layout, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { BannerGrid } from "@/components/BannerGrid";
import { reapStale } from "@/lib/banners";
import { ART_TYPES } from "@/lib/pro-options";
import { AccountHeader, AccountShell } from "@/components/account/AccountShell";

export const metadata = { title: "History" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getT();
  const es = locale === "es";
  await reapStale(user.id);
  const { type, page } = await searchParams;
  const layout = ART_TYPES.find((a) => a.layout === type?.toUpperCase())?.layout as Layout | undefined;
  const p = Math.max(1, Number(page) || 1);
  const per = 36;
  const where: Prisma.BannerWhereInput = { userId: user.id, ...(layout ? { template: { layout } } : {}) };
  const [banners, total, counts] = await Promise.all([
    db.banner.findMany({ where, include: { template: true }, orderBy: { createdAt: "desc" }, skip: (p - 1) * per, take: per }),
    db.banner.count({ where }),
    db.banner.groupBy({ by: ["templateId"], where: { userId: user.id }, _count: true }),
  ]);
  const tpls = await db.template.findMany({ where: { id: { in: counts.map((c) => c.templateId).filter(Boolean) as string[] } }, select: { id: true, layout: true } });
  const perLayout = new Map<string, number>();
  for (const c of counts) {
    const l = tpls.find((x) => x.id === c.templateId)?.layout;
    if (l) perLayout.set(l, (perLayout.get(l) ?? 0) + c._count);
  }
  const all = counts.reduce((n, c) => n + c._count, 0);
  const href = (l?: string, pg?: number) => `/history?${new URLSearchParams({ ...(l ? { type: l.toLowerCase() } : {}), ...(pg && pg > 1 ? { page: String(pg) } : {}) })}`;
  const pages = Math.ceil(total / per);

  return (
    <AccountShell user={user}>
      <AccountHeader
        title={es ? "Historial" : "History"}
        sub={es ? "Todos los artes que has creado" : "Every art you've created"}
        action={<Link href="/create" className="btn-primary px-4 py-2 text-sm">＋ {es ? "Nuevo arte" : "New art"}</Link>}
      />
      <div className="flex flex-wrap gap-2">
        <Link href={href()} className={`chip ${!layout ? "border-lime bg-lime text-ink" : "text-muted"}`}>
          {es ? "Todos" : "All"} <span className="opacity-60">{all}</span>
        </Link>
        {ART_TYPES.filter((a) => perLayout.get(a.layout)).map((a) => (
          <Link key={a.layout} href={href(a.layout)} className={`chip ${layout === a.layout ? "border-lime bg-lime text-ink" : "text-muted"}`}>
            {a.icon} {es ? a.es.name : a.en.name} <span className="opacity-60">{perLayout.get(a.layout)}</span>
          </Link>
        ))}
      </div>
      {banners.length ? (
        <BannerGrid banners={banners} labels={{ processing: t("processing"), failed: t("failed"), open: t("open") }} />
      ) : (
        <div className="card grid place-items-center gap-3 p-12 text-center">
          <div className="text-4xl">🎨</div>
          <div className="font-bold">{es ? "Aún no hay artes aquí" : "No arts here yet"}</div>
          <Link href="/create" className="btn-primary px-5 py-2 text-sm">{es ? "Crear mi primer arte" : "Create my first art"}</Link>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {p > 1 && <Link className="btn-ghost px-4 py-2" href={href(layout, p - 1)}>‹ {es ? "Anterior" : "Previous"}</Link>}
          <span className="text-muted">{p} / {pages}</span>
          {p < pages && <Link className="btn-ghost px-4 py-2" href={href(layout, p + 1)}>{es ? "Siguiente" : "Next"} ›</Link>}
        </div>
      )}
    </AccountShell>
  );
}
