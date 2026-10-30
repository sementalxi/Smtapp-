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
export async function visibleCategories(): Promise<LayoutKind[]> {
  const c = await getCategoryConfig();
  return c.order.filter((l) => !c.hidden.includes(l));
}
