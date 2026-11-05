import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl, toJson } from "@/lib/banners";
import { TemplateSchema } from "@/lib/template-schema";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  await apiAdmin(); (await import("@/lib/memo")).bust("settings", "texts", "templates:");
  const { id } = await params;
  const body = TemplateSchema.partial().parse(await req.json());
  assertOwnUrl(body.styleRefUrl);
  assertOwnUrl(body.thumbUrl);
  if (body.slug) {
    const clash = await db.template.findFirst({ where: { slug: body.slug, NOT: { id } } });
    if (clash) return json({ error: "Slug already used" }, 409);
  }
  const { style, ...rest } = body;
  await db.template
    .update({ where: { id }, data: { ...rest, ...(style ? { style: toJson(style) } : {}) } })
    .catch(() => {
      throw new HttpError(404, "not_found");
    });
  return json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin(); (await import("@/lib/memo")).bust("settings", "texts", "templates:");
  const { id } = await params;
  const used = await db.banner.count({ where: { templateId: id } });
  if (used > 0) {
    // Posters were made with it: archive (disappears everywhere, old posters keep their style, restorable from the bin).
    await db.template.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    return json({ ok: true, archived: true });
  }
  await db.template.delete({ where: { id } });
  return json({ ok: true });
});
