import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { FlyerStudio } from "@/components/admin/FlyerStudio";

export const dynamic = "force-dynamic";

export default async function AdminStudio() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const hist = await db.setting.findUnique({ where: { key: "studio_recent" } });
  const recent: { url: string; at: number; kind: string; size: string }[] = hist ? JSON.parse(hist.value) : [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{es ? "Estudio libre" : "Free studio"}</h1>
        <p className="text-sm text-muted">
          {es
            ? "Solo para admins. Crea cualquier flyer, logo o gráfico: sube tus fotos, elige el tamaño y escribe lo que quieras. No gasta créditos."
            : "Admins only. Make any flyer, logo or graphic: upload your pictures, pick the size and write whatever you want. Uses no credits."}
        </p>
      </div>
      <FlyerStudio recent={recent} />
    </div>
  );
}
