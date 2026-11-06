import { textSlotsFor } from "./text-slots";
import { db } from "./db";
import type { ClientTemplate } from "./samples";
import type { TemplateStyle } from "./templates";

/** Which styles this viewer may see: admins see all; organizations see "all"+"orgs"; everyone else "all"+"users". */
export function audienceFor(viewer?: { role?: string; isOrg?: boolean } | null): string[] | null {
  if (viewer?.role === "ADMIN" || viewer?.role === "STAFF") return null;
  return viewer?.isOrg ? ["all", "orgs"] : ["all", "users"];
}
export function canUseTemplate(t: { audience?: string | null }, viewer?: { role?: string; isOrg?: boolean } | null) {
  const a = audienceFor(viewer);
  return !a || a.includes(t.audience || "all");
}

export async function activeTemplates(viewer?: { role?: string; isOrg?: boolean } | null): Promise<ClientTemplate[]> {
  const aud = audienceFor(viewer);
  const { memo } = await import("./memo");
  return memo(`templates:${aud?.join(",") ?? "all"}@${await (await import("./rev")).getRev()}`, 60_000, () => loadTemplates(aud));
}

async function loadTemplates(aud: string[] | null): Promise<ClientTemplate[]> {
  const rows = await db.template.findMany({ where: { active: true, deletedAt: null, ...(aud ? { audience: { in: aud } } : {}) }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] });
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
    tier: r.tier,
    crestDefault: (() => {
      const tag = /\[CREST (3D EXACT|3D|BOTH|PASTE|EXACT)\]/i.exec(r.proInstructions ?? "")?.[1]?.toUpperCase();
      return tag ? ({ "3D EXACT": "exact3d", "3D": "on", BOTH: "both", PASTE: "off", EXACT: "exact" } as Record<string, string>)[tag] ?? null : null;
    })(),
    wide: /\[WIDE\]/.test(r.proInstructions ?? ""),
    logoCreate: /\[LOGO CREATE\]/.test(r.proInstructions ?? ""),
    textSlots: textSlotsFor(r.slug, r.textSlots),
    textSlotsJson: r.textSlots,
    styleRefUrl: r.styleRefUrl,
  }));
}
