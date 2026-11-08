import { NextRequest, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError, isStaff } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { assertOwnUrl } from "@/lib/banners";

import { getNumberSetting } from "@/lib/settings";
import { changeCredits } from "@/lib/credits";
import { BLOCKED, proConfigured } from "@/lib/ai";
import { cleanLogoName, LOGO_STYLES, publicSet, runLogoSet } from "@/lib/logo-maker";

export const maxDuration = 300;

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  idea: z.string().trim().max(300).default(""),
  colors: z.string().trim().max(120).default(""),
  style: z.enum(LOGO_STYLES).default("mix"),
  refUrl: z.string().max(500).default(""),
});

/** Starts a set of 5 logo options (charged once, up front; failed options are refunded). */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "logo_set", 12, 60 * 60_000, user.id);
  if (!proConfigured()) throw new HttpError(400, "pro_not_configured");
  const b = Body.parse(await req.json());
  if (b.refUrl) assertOwnUrl(b.refUrl);
  const name = cleanLogoName(b.name);
  if (!name) return json({ error: "name_required" }, 400);
  const hit = `${name} ${b.idea} ${b.colors}`.match(BLOCKED);
  if (hit) return json({ error: "err_blocked" }, 400);
  const cost = isStaff(user.role) ? 0 : await getNumberSetting("logo_set_cost");
  if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);
  const set = await db.logoSet.create({ data: { userId: user.id, inputs: { ...b, name } as never, cost } });
  if (cost > 0) {
    try {
      await changeCredits({ userId: user.id, amount: -cost, type: "GENERATION", note: `Logo maker: 5 options for ${name}` });
    } catch {
      await db.logoSet.delete({ where: { id: set.id } });
      return json({ error: "err_credits" }, 402);
    }
  }
  after(async () => {
    try {
      await runLogoSet(set.id);
    } catch (e) {
      console.error("logo set failed", e);
      await db.logoSet.update({ where: { id: set.id }, data: { status: "FAILED", error: String(e).slice(0, 300) } }).catch(() => {});
    }
  });
  return json({ set: publicSet(set) });
});

/** The player's recent sets. */
export const GET = handle(async () => {
  const user = await apiUser();
  const sets = await db.logoSet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 });
  return json({ sets: sets.map(publicSet) });
});
