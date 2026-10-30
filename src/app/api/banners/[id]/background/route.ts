import { NextRequest, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { assertInputUrls, buildProPrompt, collectProRefs, seriesInfo, seriesRefUrl, generateForBanner, generateProForBanner, InputsSchema, titleFor, toJson } from "@/lib/banners";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { BannerInputs, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 300;

const Body = z.object({ extraPrompt: z.string().trim().max(1500).optional(), inputs: InputsSchema.optional() });

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
    const info = seriesInfo(banner.design);
    const seriesUrl = info.seriesRootId ? await seriesRefUrl(user.id, info.seriesRootId) : null;
    try {
      assertInputUrls(inputs);
      const refs = collectProRefs({
        layout: banner.template.layout,
        inputs,
        photoUrl: banner.photoUrl,
        logoUrl: banner.logoUrl,
        styleRefUrl: banner.template.styleRefUrl,
        seriesRefUrl: seriesUrl,
      });
      const prompt = buildProPrompt({
        layout: banner.template.layout,
        templatePrompt: banner.template.prompt,
        style: banner.template.style as unknown as TemplateStyle,
        inputs,
        refs,
        instructions: banner.template.proInstructions,
        randomize: banner.template.randomize,
        variation: seriesUrl ? info.variation : undefined,
        series: !!seriesUrl,
      });
      const cost = await getNumberSetting("pro_cost");
      if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);
      await db.banner.update({ where: { id }, data: { inputs: toJson(inputs), title: titleFor(inputs), error: null } });
      // Runs in the background; the page polls until finalUrl changes or an error is saved.
      after(async () => {
        try {
          await generateProForBanner({ bannerId: banner.id, userId: user.id, cost, prompt, refs, regenerate: true });
        } catch (e) {
          // generateProForBanner already saved the real reason for AI failures — don't overwrite it.
          if (e instanceof HttpError && (e.message === "err_blocked" || e.message === "generation_failed")) return;
          const msg = e instanceof HttpError && e.status === 402 ? "err_credits" : String(e instanceof Error ? e.message : e).slice(0, 500);
          await db.banner.update({ where: { id }, data: { error: msg } }).catch(() => {});
        }
      });
      return json({ pending: true, previousUrl: banner.finalUrl });
    } catch (e) {
      if (e instanceof HttpError && e.status === 402) return json({ error: "err_credits" }, 402);
      if (e instanceof HttpError && e.message === "err_blocked") return json({ error: "err_blocked" }, 400);
      const failed = await db.banner.findUnique({ where: { id }, select: { error: true } });
      return json({ error: "err_generic", ...(user.role === "ADMIN" && failed?.error ? { detail: failed.error } : {}) }, 502);
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
