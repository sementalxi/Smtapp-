import { NextRequest } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";

const Layout = z.enum(["PLAYER", "CHAMPIONS", "EVENT", "MATCHDAY", "LINEUP", "RESULT", "STANDINGS", "LOGO", "TOTW", "QUALIFIERS", "WINNERS"]);
const Schema = z.object({
  categories: z.object({ order: z.array(Layout).max(10), hidden: z.array(Layout).max(10) }),
  templates: z.array(z.object({ id: z.string().min(1), layout: Layout, sort: z.number().int().min(-1000).max(100000), active: z.boolean(), badge: z.string().max(80).nullable().default(null).transform((v) => { const list = (v ?? "").split(",").map((x) => x.trim()).filter((x) => ["recommended", "fire", "photoshop", "new"].includes(x)); return list.length ? [...new Set(list)].join(",") : null; }), audience: z.enum(["all", "users", "orgs"]).default("all") })).max(500),
});

/** Admin: save category order/visibility and each style's category, order and on/off. */
export const PUT = handle(async (req: NextRequest) => {
  await apiAdmin(); await (await import("@/lib/rev")).bumpRev();
  const b = Schema.parse(await req.json());
  const value = JSON.stringify(b.categories);
  await db.$transaction([
    db.setting.upsert({ where: { key: "categories" }, create: { key: "categories", value }, update: { value } }),
    ...b.templates.map((t) => db.template.update({ where: { id: t.id }, data: { layout: t.layout, sort: t.sort, active: t.active, badge: t.badge, audience: t.audience } })),
  ]);
  for (const p of ["/", "/create", "/dashboard", "/admin/templates"]) revalidatePath(p);
  return json({ ok: true });
});
