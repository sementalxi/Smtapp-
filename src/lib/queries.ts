import { db } from "./db";
import type { ClientTemplate } from "./samples";
import type { TemplateStyle } from "./templates";

/** Which styles this viewer may see: admins see all; organizations see "all"+"orgs"; everyone else "all"+"users". */
export function audienceFor(viewer?: { role?: string; isOrg?: boolean } | null): string[] | null {
  if (viewer?.role === "ADMIN") return null;
  return viewer?.isOrg ? ["all", "orgs"] : ["all", "users"];
}
export function canUseTemplate(t: { audience?: string | null }, viewer?: { role?: string; isOrg?: boolean } | null) {
  const a = audienceFor(viewer);
  return !a || a.includes(t.audience || "all");
}

export async function activeTemplates(viewer?: { role?: string; isOrg?: boolean } | null): Promise<ClientTemplate[]> {
  const aud = audienceFor(viewer);
  const rows = await db.template.findMany({ where: { active: true, ...(aud ? { audience: { in: aud } } : {}) }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameEs: r.nameEs,
    layout: r.layout,
    style: r.style as unknown as TemplateStyle,
    cost: r.cost,
    thumbUrl: r.thumbUrl,
    hasInstructions: !!r.proInstructions?.trim(),
    badge: r.badge,
    wide: /\[WIDE\]/.test(r.proInstructions ?? ""),
    logoCreate: /\[LOGO CREATE\]/.test(r.proInstructions ?? ""),
  }));
}
