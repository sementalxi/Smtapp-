import { NextRequest, after } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl, toJson } from "@/lib/banners";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { TemplateSchema } from "@/lib/template-schema";

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin(); await (await import("@/lib/rev")).bumpRev();
  const raw = await req.json();
  // Allow creating from a minimal body by filling in a default style.
  const body = TemplateSchema.parse({
    style: DEFAULT_TEMPLATES[0].style,
    cost: 1,
    active: false,
    sort: 100,
    ...raw,
  });
  assertOwnUrl(body.styleRefUrl);
  assertOwnUrl(body.thumbUrl);
  const exists = await db.template.findUnique({ where: { slug: body.slug } });
  if (exists) return json({ error: "Slug already used" }, 409);
  const { textSlots, ...rest } = body;
  const t = await db.template.create({ data: { ...rest, style: toJson(body.style), textSlots: textSlots?.length ? JSON.stringify(textSlots) : null } });
  // A new style with a reference flyer: read its text lines in the background so the boxes are ready to add.
  if (body.styleRefUrl && !textSlots?.length) after(async () => (await import("@/lib/detect-slots")).autoDetectSlotsForTemplate(t.id));
  return json({ id: t.id });
});
