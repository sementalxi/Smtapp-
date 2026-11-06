import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { syncAllTwins } from "@/lib/qualifiers-twins";

export const maxDuration = 60;

/** Admin: create / refresh the Qualifiers and Winners-showcase twins of the Photoshop player styles. */
export const POST = handle(async () => {
  await apiAdmin();
  const r = await syncAllTwins(db);
  await (await import("@/lib/rev")).bumpRev();
  return json({ ok: true, created: r.qualifiers.created + r.winners.created, updated: r.qualifiers.updated + r.winners.updated, sources: r.qualifiers.sources, ...r });
});
