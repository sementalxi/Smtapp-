import { db } from "./db";
import { ART_TYPES } from "./pro-options";
import type { LayoutKind } from "./templates";

export type CategoryConfig = { order: LayoutKind[]; hidden: LayoutKind[] };
const ALL = ART_TYPES.map((a) => a.layout);

/** Category order + hidden categories, set by the admin (Setting "categories"). */
export async function getCategoryConfig(): Promise<CategoryConfig> {
  let saved: Partial<CategoryConfig> = {};
  try {
    const row = await db.setting.findUnique({ where: { key: "categories" } });
    if (row?.value) saved = JSON.parse(row.value);
  } catch {
    /* defaults */
  }
  const order = [...(saved.order ?? []).filter((l) => ALL.includes(l)), ...ALL.filter((l) => !(saved.order ?? []).includes(l))];
  return { order, hidden: (saved.hidden ?? []).filter((l) => ALL.includes(l)) };
}

/** Visible categories in the admin's order. */
export async function visibleCategories(viewer?: { role?: string | null }): Promise<LayoutKind[]> {
  const c = await getCategoryConfig();
  const shown = c.order.filter((l) => !c.hidden.includes(l));
  // "Coming soon" categories stay out of sight for players until they open (staff still see them to test).
  if (viewer && !["ADMIN", "STAFF", "SUPPORT"].includes(viewer.role ?? "")) {
    const soon = await import("./coming-soon").then((m) => m.comingSoonList());
    return shown.filter((l) => !soon.includes(l));
  }
  return shown;
}
