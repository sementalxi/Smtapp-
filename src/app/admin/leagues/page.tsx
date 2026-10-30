import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { LibraryManager } from "@/components/admin/LibraryManager";

export default async function AdminLeagues() {
  await requireAdmin();
  const { locale } = await getT();
  const items = await db.libraryItem.findMany({ orderBy: [{ kind: "asc" }, { sort: "asc" }, { name: "asc" }] });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{locale === "es" ? "Ligas y logos" : "Leagues & logos"}</h1>
      <LibraryManager initial={items.map((i) => ({ id: i.id, kind: i.kind as "championship" | "team" | "partner", name: i.name, logoUrl: i.logoUrl }))} />
    </div>
  );
}
