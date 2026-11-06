import { NextRequest, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError, isStaff } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { assertInputUrls, buildProPrompt, collectProRefs, seriesInfo, seriesRefUrl, generateForBanner, generateProForBanner, InputsSchema, titleFor, toJson } from "@/lib/banners";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting, getSettings } from "@/lib/settings";
import { BannerInputs, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 300;

const COMPARE_MODELS = ["mix3", "seedream-mix", "mix", "flux-mix", "flux", "openai", "nano-pro"] as const;
const Body = z.object({
  extraPrompt: z.string().trim().max(1500).optional(),
  inputs: InputsSchema.optional(),
  cardTemplateId: z.string().max(40).optional(),
  /** Admin comparison: make this copy with one specific generator (free for admins). */
  compareModel: z.enum(COMPARE_MODELS).optional(),
});

// Paid: paints a brand-new AI background for an existing banner.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  const body = Body.parse(await req.json().catch(() => ({})));
  const compare = isStaff(user.role) ? body.compareModel : undefined;
  if (!compare) rateLimit(req, "generate", 30, 60 * 60_000, user.id);

  const banner = await db.banner.findUnique({ where: { id }, include: { template: true } });
  if (!banner || banner.userId !== user.id) throw new HttpError(404, "not_found");

  // Pro AI banner: make a whole new version of the poster (with any edited text).
  if (banner.mode === "PRO") {
    if (!proConfigured()) throw new HttpError(400, "pro_not_configured");
    const inputs: BannerInputs = body.inputs
      ? { ...EMPTY_INPUTS, ...body.inputs }
      : { ...EMPTY_INPUTS, ...(banner.inputs as unknown as Partial<BannerInputs>) };
    inputs.aiLogo = await (await import("@/lib/settings")).resolveCrestMode(banner.template.layout, inputs.aiLogo || undefined, isStaff(user.role), banner.template.proInstructions);
    const info = seriesInfo(banner.design);
    const seriesUrl = info.seriesRootId ? await seriesRefUrl(user.id, info.seriesRootId) : null;
    try {
      if (banner.template.layout === "WINNERS") Object.assign(inputs, await (await import("@/lib/winners-crests")).fillWinnerCrests(banner.userId, inputs));
      assertInputUrls(inputs);
      const design = (banner.design ?? {}) as { look?: { templateId?: string }; totw?: { cardTemplateId?: string } };
      const totw = ["TOTW", "STANDINGS", "EVENT", "QUALIFIERS", "WINNERS"].includes(banner.template.layout) ? await import("@/lib/totw").then((m) => m.totwExtras(inputs, body.cardTemplateId ?? design.look?.templateId ?? design.totw?.cardTemplateId, user, banner.template.layout)) : null;
      const fmtNow = (banner.design as unknown as { format?: "post" | "story" | "banner" } | null)?.format;
      const exactTable = banner.template.layout === "STANDINGS" && ((await getSettings()).standings_exact_table !== "off" || inputs.standings.filter(Boolean).length > 16) && (await import("@/lib/standings-table").then((m) => m.tableFontsReady()));
      const exactQual = banner.template.layout === "QUALIFIERS" && (await getSettings()).qualifiers_exact_table !== "off" && (await import("@/lib/standings-table").then((m) => m.tableFontsReady()));
      const exactWin = banner.template.layout === "WINNERS" && (await getSettings()).winners_exact_grid !== "off" && (await import("@/lib/standings-table").then((m) => m.tableFontsReady()));
      const crestNote = banner.logoUrl && (inputs.aiLogo === "on" || inputs.aiLogo === "both") ? await (await import("@/lib/crest-describe")).describeCrest(banner.logoUrl) : null;
      const refColours = banner.template.styleRefUrl && (!inputs.colorMode || inputs.colorMode === "template") ? await (await import("@/lib/ref-palette")).referenceColourLine(banner.template.styleRefUrl) : null;
      const refs = collectProRefs({
        layout: banner.template.layout,
        inputs,
        photoUrl: banner.photoUrl,
        logoUrl: banner.logoUrl,
        styleRefUrl: banner.template.styleRefUrl,
        seriesRefUrl: seriesUrl,
        crestSheet: totw?.crestSheet,
        skipTableCrests: exactTable || exactWin,
        instructions: banner.template.proInstructions,
        crestNote,
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
        format: (banner.design as unknown as { format?: "post" | "story" | "banner" } | null)?.format,
        cardLook: totw?.cardLook,
        exactTable: exactTable || exactQual || exactWin,
        slug: banner.template.slug,
        textSlotsJson: banner.template.textSlots,
        season: await (async () => {
          const s = (banner.design as unknown as { season?: { key: string; custom?: string } } | null)?.season;
          if (!s) return "";
          const { seasonByKey, seasonPrompt } = await import("@/lib/seasons");
          return seasonPrompt(seasonByKey(s.key, s.custom));
        })(),
        crestNote,
        refColours,
      });
      const cost = compare ? 0 : await getNumberSetting("pro_cost");
      if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);
      // A new design is saved as a NEW poster — the old one stays untouched in the history.
      const copy = await db.banner.create({
        data: {
          userId: banner.userId,
          templateId: banner.templateId,
          title: titleFor(inputs),
          inputs: toJson(inputs),
          design: toJson({ ...((banner.design ?? {}) as Record<string, unknown>), ...(compare ? { compareOf: banner.id, compareModel: compare } : {}) }),
          photoUrl: banner.photoUrl,
          logoUrl: banner.logoUrl,
          mode: "PRO",
        },
      });
      // Runs in the background; the page polls the new poster until it's ready or an error is saved.
      const accent = totw?.cardLook?.colours?.accent ?? (banner.template.style as unknown as { accent?: string } | null)?.accent ?? "#ffc83d";
      const tableOverlay = exactTable ? await import("@/lib/standings-table").then((m) => m.tableSpecFrom(inputs, accent, fmtNow === "banner")) : null;
      const qualOverlay = exactQual ? await import("@/lib/qualifiers-table").then((m) => m.qualTableSpecFrom(inputs, accent, fmtNow ?? "post")) : null;
      const winnersOverlay = exactWin ? await import("@/lib/winners-grid").then((m) => m.winnersSpecFrom(inputs, accent, fmtNow ?? "post")) : null;
      after(async () => {
        try {
          await generateProForBanner({ bannerId: copy.id, userId: user.id, cost, prompt, refs, regenerate: true, qualOverlay, winnersOverlay, ...(compare ? { modelOverride: compare } : {}), instructions: banner.template.proInstructions, format: fmtNow, openaiOnly: ((await getSettings()).openai_only_layouts ?? "").split(",").includes(banner.template.layout), tableOverlay });
        } catch (e) {
          // generateProForBanner already saved the real reason for AI failures — don't overwrite it.
          if (e instanceof HttpError && (e.message === "err_blocked" || e.message === "generation_failed")) return;
          const msg = e instanceof HttpError && e.status === 402 ? "err_credits" : String(e instanceof Error ? e.message : e).slice(0, 500);
          await db.banner.update({ where: { id: copy.id }, data: { status: "FAILED", error: msg } }).catch(() => {});
        }
      });
      return json({ pending: true, id: copy.id });
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
