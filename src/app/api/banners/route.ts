import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { aiConfigured, assertOwnUrl, defaultDesign, generateForBanner, InputsSchema, titleFor, toJson } from "@/lib/banners";
import { EMPTY_INPUTS } from "@/lib/templates";

export const maxDuration = 60;

const Body = z.object({
  templateId: z.string().min(1),
  inputs: InputsSchema,
  photoUrl: z.string().max(500).nullish(),
  logoUrl: z.string().max(500).nullish(),
  isCutout: z.boolean().optional(),
});

export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "generate", 30, 60 * 60_000, user.id);
  const body = Body.parse(await req.json());
  assertOwnUrl(body.photoUrl);
  assertOwnUrl(body.logoUrl);

  const template = await db.template.findFirst({ where: { id: body.templateId, active: true } });
  if (!template) throw new HttpError(404, "template_not_found");
  if (template.layout === "PLAYER" && !body.photoUrl) throw new HttpError(400, "photo_required");

  const inputs = { ...EMPTY_INPUTS, ...body.inputs };
  // Fast path; the real check is atomic inside generateForBanner.
  if (aiConfigured() && user.credits < template.cost) return json({ error: "err_credits" }, 402);

  const banner = await db.banner.create({
    data: {
      userId: user.id,
      templateId: template.id,
      title: titleFor(inputs),
      inputs: toJson(inputs),
      design: toJson(defaultDesign()),
      photoUrl: body.photoUrl ?? null,
      logoUrl: body.logoUrl ?? null,
    },
  });

  try {
    await generateForBanner({
      bannerId: banner.id,
      userId: user.id,
      cost: template.cost,
      prompt: template.prompt,
      extraPrompt: inputs.extraPrompt,
      photoUrl: body.photoUrl,
      isCutout: body.isCutout,
    });
  } catch (e) {
    if (e instanceof HttpError && (e.status === 402 || e.message === "err_blocked")) {
      await db.banner.delete({ where: { id: banner.id } });
      return json({ error: e.status === 402 ? "err_credits" : "err_blocked" }, e.status);
    }
    throw e;
  }

  return json({ id: banner.id });
});
