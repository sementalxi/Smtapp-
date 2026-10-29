import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { DEFAULT_TEMPLATES, TemplateStyle } from "@/lib/templates";

export default async function AdminTemplates() {
  await requireAdmin();
  const { t } = await getT();
  const rows = await db.template.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { banners: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display chrome text-4xl">{t("admin_templates")}</h1>
      <div className="space-y-3">
        {rows.map((r) => (
          <TemplateEditor
            key={r.id}
            initial={{
              id: r.id,
              slug: r.slug,
              name: r.name,
              nameEs: r.nameEs,
              layout: r.layout,
              prompt: r.prompt,
              style: r.style as unknown as TemplateStyle,
              cost: r.cost,
              active: r.active,
              sort: r.sort,
              styleRefUrl: r.styleRefUrl,
              proInstructions: r.proInstructions,
              randomize: r.randomize,
              uses: r._count.banners,
            }}
          />
        ))}
      </div>
      <h2 className="font-display pt-6 text-2xl">{t("new_template")}</h2>
      <TemplateEditor
        isNew
        initial={{
          slug: `custom-${rows.length + 1}`,
          name: "New style",
          nameEs: "Nuevo estilo",
          layout: "PLAYER",
          prompt: DEFAULT_TEMPLATES[0].prompt,
          style: DEFAULT_TEMPLATES[0].style,
          cost: 1,
          active: false,
          sort: rows.length + 1,
        }}
      />
    </div>
  );
}
