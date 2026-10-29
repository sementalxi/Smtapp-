import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import {
  aiConfigured,
  assertOwnUrl,
  assertInputUrls,
  buildProPrompt,
  collectProRefs,
  defaultDesign,
  generateForBanner,
  generateProForBanner,
  InputsSchema,
  titleFor,
  toJson,
} from "@/lib/banners";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";

// Pro AI posters take 1–2 minutes (Vercel allows up to 300 s with Fluid compute).
export const maxDuration = 300;

const Body = z.object({
  templateId: z.string().min(1),
  inputs: InputsSchema,
  photoUrl: z.string().max(500).nullish(),
  logoUrl: z.string().max(500).nullish(),
  isCutout: z.boolean().optional(),
  mode: z.enum(["QUICK", "PRO"]).default("QUICK"),
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
  const pro = body.mode === "PRO";
  if (pro && !proConfigured()) throw new HttpError(400, "pro_not_configured");
  if (!pro && !["PLAYER", "CHAMPIONS", "EVENT"].includes(template.layout)) throw new HttpError(400, "pro_only_layout");
  const cost = pro ? await getNumberSetting("pro_cost") : aiConfigured() ? template.cost : 0;
  // Fast path; the real check is atomic when credits are taken.
  if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);

  assertInputUrls(inputs);
  let proPrompt = "";
  const refs = collectProRefs({
    layout: template.layout,
    inputs,
    photoUrl: body.photoUrl,
    logoUrl: body.logoUrl,
    styleRefUrl: template.styleRefUrl,
  });
  if (pro) {
    try {
    proPrompt = buildProPrompt({
      layout: template.layout,
      templatePrompt: template.prompt,
      style: template.style as unknown as TemplateStyle,
      inputs,
      refs,
      instructions: template.proInstructions,
      randomize: template.randomize,
    }); // throws err_blocked before anything is charged
    } catch (e) {
      const detail = (e as { detail?: string }).detail;
      return json({ error: "err_blocked", ...(user.role === "ADMIN" && detail ? { detail } : {}) }, 400);
    }
  }

  const banner = await db.banner.create({
    data: {
      userId: user.id,
      templateId: template.id,
      title: titleFor(inputs),
      inputs: toJson(inputs),
      design: toJson(defaultDesign()),
      photoUrl: body.photoUrl ?? null,
      logoUrl: body.logoUrl ?? null,
      mode: body.mode,
    },
  });

  let finalUrl: string | null = null;
  try {
    if (pro) {
      const done = await generateProForBanner({
        bannerId: banner.id,
        userId: user.id,
        cost,
        prompt: proPrompt,
        refs,
      });
      finalUrl = done.finalUrl;
    } else await generateForBanner({
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
      const detail = (e as { detail?: string }).detail;
      return json(
        { error: e.status === 402 ? "err_credits" : "err_blocked", ...(user.role === "ADMIN" && detail ? { detail } : {}) },
        e.status,
      );
    }
    // Admins see the real reason so problems can be fixed quickly.
    const failed = await db.banner.findUnique({ where: { id: banner.id }, select: { error: true } });
    return json(
      { error: "err_generic", ...(user.role === "ADMIN" && failed?.error ? { detail: failed.error } : {}) },
      e instanceof HttpError ? e.status : 500,
    );
  }

  return json({ id: banner.id, finalUrl });
});
