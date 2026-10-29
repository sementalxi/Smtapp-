import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { toJson } from "@/lib/banners";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { TemplateSchema } from "@/lib/template-schema";

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const raw = await req.json();
  // Allow creating from a minimal body by filling in a default style.
  const body = TemplateSchema.parse({
    style: DEFAULT_TEMPLATES[0].style,
    cost: 1,
    active: false,
    sort: 100,
    ...raw,
  });
  const exists = await db.template.findUnique({ where: { slug: body.slug } });
  if (exists) return json({ error: "Slug already used" }, 409);
  const t = await db.template.create({ data: { ...body, style: toJson(body.style) } });
  return json({ id: t.id });
});
