// Live activity log (Admin → Live log). Never throws — logging must not break anything.
import { db } from "./db";

export type Level = "info" | "warn" | "error";
let lastPrune = 0;

export async function logActivity(source: "site" | "bot", kind: string, message: string, level: Level = "info") {
  try {
    await db.activityLog.create({ data: { source, kind: kind.slice(0, 40), message: message.slice(0, 1000), level } });
    if (Date.now() - lastPrune > 60 * 60_000) {
      lastPrune = Date.now();
      await db.activityLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 3600_000) } } });
    }
  } catch {}
}
