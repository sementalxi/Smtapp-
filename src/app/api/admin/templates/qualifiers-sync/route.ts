import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { syncQualifiersTwins } from "@/lib/qualifiers-twins";

export const maxDuration = 60;

/** Admin: create / refresh the Qualifiers twins of the Photoshop player styles. */
export const POST = handle(async () => {
  await apiAdmin();
  const r = await syncQualifiersTwins(db);
  await (await import("@/lib/rev")).bumpRev();
  return json({ ok: true, ...r });
});
