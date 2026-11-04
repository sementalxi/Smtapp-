// Pictures behind the "What are you making?" boxes, chosen by the admin (Admin → Styles).
import { db } from "./db";

export const TYPE_PIC_KEYS = ["PLAYER", "CHAMPIONS", "MATCHDAY", "LINEUP", "RESULT", "EVENT", "STANDINGS", "LOGO", "ROSTER", "TEAMSET", "SEASON"] as const;

export async function getTypePics(): Promise<Record<string, string>> {
  const row = await db.setting.findUnique({ where: { key: "type_pics" } }).catch(() => null);
  try {
    const v = row ? JSON.parse(row.value) : {};
    return Object.fromEntries(Object.entries(v).filter(([k, u]) => (TYPE_PIC_KEYS as readonly string[]).includes(k) && typeof u === "string" && u)) as Record<string, string>;
  } catch {
    return {};
  }
}
