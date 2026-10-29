import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { buildProPrompt, generateForBanner, generateProForBanner, InputsSchema, titleFor, toJson } from "@/lib/banners";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { BannerInputs, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 300;

const Body = z.object({ extraPrompt: z.string().trim().max(200).optional(), inputs: InputsSchema.optional() });

// Paid: paints a brand-new AI background for an existing banner.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  rateLimit(req, "generate", 30, 60 * 60_000, user.id);
  const { id } = await params;
  const body = Body.parse(await req.json().catch(() => ({})));

  const banner = await db.banner.findUnique({ where: { id }, include: { template: true } });
  if (!banner || banner.userId !== user.id) throw new HttpError(404, "not_found");

  // Pro AI banner: make a whole new version of the poster (with any edited text).
  if (banner.mode === "PRO") {
    if (!proConfigured()) throw new HttpError(400, "pro_not_configured");
    const inputs: BannerInputs = body.inputs
      ? { ...EMPTY_INPUTS, ...body.inputs }
      : { ...EMPTY_INPUTS, ...(banner.inputs as unknown as Partial<BannerInputs>) };
    try {
      const prompt = buildProPrompt({
        layout: banner.template.layout,
        templatePrompt: banner.template.prompt,
        style: banner.template.style as unknown as TemplateStyle,
        inputs,
        hasPhoto: !!banner.photoUrl,
        hasLogo: !!banner.logoUrl,
      });
      await db.banner.update({ where: { id }, data: { inputs: toJson(inputs), title: titleFor(inputs) } });
      const updated = await generateProForBanner({
        bannerId: banner.id,
        userId: user.id,
        cost: await getNumberSetting("pro_cost"),
        prompt,
        photoUrl: banner.photoUrl,
        logoUrl: banner.logoUrl,
        regenerate: true,
      });
      return json({ finalUrl: updated.finalUrl });
    } catch (e) {
      if (e instanceof HttpError && e.status === 402) return json({ error: "err_credits" }, 402);
      if (e instanceof HttpError && e.message === "err_blocked") return json({ error: "err_blocked" }, 400);
      throw e;
    }
  }

  const old = banner.backgroundUrl;
  try {
    const updated = await generateForBanner({
      bannerId: banner.id,
      userId: user.id,
      cost: banner.template.cost,
      prompt: banner.template.prompt,
      extraPrompt: body.extraPrompt ?? "",
      backgroundOnly: true,
    });
    if (old && old !== updated.backgroundUrl) await deleteFile(old);
    return json({ backgroundUrl: updated.backgroundUrl });
  } catch (e) {
    if (e instanceof HttpError && e.status === 402) return json({ error: "err_credits" }, 402);
    if (e instanceof HttpError && e.message === "err_blocked") return json({ error: "err_blocked" }, 400);
    throw e;
  }
});
