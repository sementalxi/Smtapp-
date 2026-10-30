import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { DealsManager, type AdminDeal } from "@/components/admin/DealsManager";

export default async function AdminDeals() {
  await requireAdmin();
  const { locale } = await getT();
  const rows = await db.deal.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "desc" }] });
  const deals: AdminDeal[] = rows.map((d) => ({
    id: d.id,
    title: d.title,
    subtitle: d.subtitle,
    price: d.price,
    tags: d.tags,
    included: d.included,
    imageUrl: d.imageUrl,
    ctaLabel: d.ctaLabel,
    ctaHref: d.ctaHref,
    endsAt: d.endsAt ? d.endsAt.toISOString() : "",
    active: d.active,
    sort: d.sort,
  }));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{locale === "es" ? "Ofertas" : "Deals"}</h1>
      <DealsManager initial={deals} />
    </div>
  );
}
