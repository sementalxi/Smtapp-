import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { SEASONS, saveSeasonState } from "@/lib/seasons";

const Body = z.object({
  on: z.boolean(),
  key: z.string().refine((k) => k === "" || k === "custom" || SEASONS.some((s) => s.key === k)),
  custom: z.string().max(600).optional(),
});

/** Admin: turn season flyers on/off and pick the season. */
export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin(); await (await import("@/lib/rev")).bumpRev();
  const b = Body.parse(await req.json());
  await saveSeasonState({ on: b.on && !!b.key, key: b.key, custom: b.custom ?? "" });
  for (const p of ["/create", "/admin/templates"]) revalidatePath(p);
  return json({ ok: true });
});
