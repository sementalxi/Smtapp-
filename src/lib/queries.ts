import { db } from "./db";
import type { ClientTemplate } from "./samples";
import type { TemplateStyle } from "./templates";

export async function activeTemplates(): Promise<ClientTemplate[]> {
  const rows = await db.template.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameEs: r.nameEs,
    layout: r.layout,
    style: r.style as unknown as TemplateStyle,
    cost: r.cost,
  }));
}
