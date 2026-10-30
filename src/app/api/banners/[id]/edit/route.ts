import { NextRequest, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { proConfigured, BLOCKED } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { assertOwnUrl, collectProRefs, generateProForBanner, titleFor, toJson, type ProRef } from "@/lib/banners";
import { bgScenePrompt } from "@/lib/pro-options";
import { BannerInputs, EMPTY_INPUTS } from "@/lib/templates";

export const maxDuration = 300;

const TEXT_KEYS = ["name", "team", "position", "number", "tagline", "subtitle", "footer", "headline", "eventName", "prize", "date", "details", "homeTeam", "awayTeam", "homeScore", "awayScore", "competition", "venue", "time"] as const;
const LABELS: Record<string, string> = {
  name: "name / title", team: "team name", position: "position tag", number: "jersey number", tagline: "small word above the name",
  subtitle: "accent line", footer: "bottom line", headline: "main title", eventName: "competition line", prize: "prize badge",
  date: "date", details: "details", homeTeam: "home team", awayTeam: "away team", homeScore: "home score", awayScore: "away score",
  competition: "competition", venue: "venue", time: "time",
};

const Body = z.object({
  text: z.record(z.string(), z.string().max(60)).optional(),
  colors: z.object({ c1: z.string().regex(/^#[0-9a-fA-F]{6}$/), c2: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).optional(),
  scene: z.string().max(40).optional(),
  photoUrl: z.string().max(500).optional(),
  logoUrl: z.string().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

const q = (s: string) => `"${s.replace(/"/g, "'")}"`;

// "Edit this design": the AI edits the finished poster, changing only what the user picked.
// The result is saved as a NEW version (the original stays untouched).
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  rateLimit(req, "generate", 30, 60 * 60_000, user.id);
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (!proConfigured()) throw new HttpError(400, "pro_not_configured");
  const src = await db.banner.findFirst({ where: { id, userId: user.id, mode: "PRO", status: "READY" }, include: { template: true } });
  if (!src?.finalUrl) throw new HttpError(404, "not_found");
  assertOwnUrl(body.photoUrl);
  assertOwnUrl(body.logoUrl);

  const old = { ...EMPTY_INPUTS, ...(src.inputs as unknown as Partial<BannerInputs>) };
  const inputs: BannerInputs = { ...old };
  const changes: string[] = [];
  const refs: ProRef[] = [{ url: src.finalUrl, label: "the CURRENT POSTER to edit" }];

  for (const k of TEXT_KEYS) {
    const v = body.text?.[k];
    if (v === undefined) continue;
    const nv = v.trim();
    const ov = String(old[k] ?? "").trim();
    if (nv === ov) continue;
    (inputs as unknown as Record<string, string>)[k] = nv;
    if (!ov) changes.push(`Add the ${LABELS[k]} text ${q(nv)} in a fitting spot, matching the poster's existing typography.`);
    else if (!nv) changes.push(`Remove the text ${q(ov)} and fill its place with matching background.`);
    else changes.push(`Change the text ${q(ov)} to ${q(nv)} — exactly the same font, size, effects and position.`);
  }
  if (body.colors) {
    inputs.colorMode = "custom";
    inputs.color1 = body.colors.c1;
    inputs.color2 = body.colors.c2 ?? "";
    changes.push(`Recolour the whole poster to main colour ${body.colors.c1}${body.colors.c2 ? ` and second colour ${body.colors.c2}` : ""} — lighting, background, effects, glow and title colours — keeping the exact same design.`);
  }
  if (body.scene && bgScenePrompt(body.scene)) {
    inputs.bgScene = body.scene;
    changes.push(`Replace only the background with: ${bgScenePrompt(body.scene)}. Keep every foreground element, figure and text exactly as it is.`);
  }
  let photoUrl = src.photoUrl;
  if (body.photoUrl) {
    photoUrl = body.photoUrl;
    refs.push({ url: body.photoUrl, label: "the NEW PERSON for the poster" });
    changes.push(`Replace the person/player with the person in reference image ${refs.length} — same pose, position, size and lighting as the current figure(s), face exactly recognisable, same style treatment.`);
  }
  const logoUrl = body.logoUrl ?? src.logoUrl;
  // Real (exact) logos are pasted again on top after the edit; AI-drawn ones get the new crest as a reference.
  const placed = collectProRefs({ layout: src.template.layout, inputs, photoUrl: null, logoUrl, styleRefUrl: null }).filter((r) => r.overlay);
  if (body.logoUrl && !placed.length) {
    refs.push({ url: body.logoUrl, label: "the NEW TEAM CREST" });
    changes.push(`Replace the team crest/logo with the crest in reference image ${refs.length}, rendered in the same style and position, faithful to it.`);
  }
  if (body.note) changes.push(body.note);
  if (!changes.length && !body.logoUrl) throw new HttpError(400, "no_changes");

  const allText = [...Object.values(body.text ?? {}), body.note ?? ""].join(" ");
  if (BLOCKED.test(allText)) throw new HttpError(400, "err_blocked");

  const cost = await getNumberSetting("pro_cost");
  if (cost > 0 && user.credits < cost) return json({ error: "err_credits" }, 402);

  const prompt = [
    `EDIT this existing poster (reference image 1). Keep it IDENTICAL — same layout, composition, figures, typography, style, lighting, colours and effects, every element in the same place and size — and change ONLY the following:`,
    changes.map((c, n) => `${n + 1}. ${c}`).join("\n") || "1. Keep everything as it is (only the crest is updated afterwards).",
    `Change nothing else. Keep the same 4:5 framing and the same quality. All other text must stay exactly as it is, letter for letter.`,
    placed.length ? `Keep the team crest area(s) exactly where they are — the official crest is placed there again afterwards.` : "",
    `Do not reproduce the small "KIXO" watermark in the corner — leave that corner clean (it is added again afterwards).`,
    ...refs.map((r, n) => `Reference image ${n + 1} is ${r.label}.`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const copy = await db.banner.create({
    data: {
      userId: user.id,
      templateId: src.templateId,
      title: titleFor(inputs),
      inputs: toJson(inputs),
      design: toJson(src.design ?? {}),
      photoUrl,
      logoUrl,
      mode: "PRO",
    },
  });

  after(async () => {
    try {
      await generateProForBanner({ bannerId: copy.id, userId: user.id, cost, prompt, refs: [...refs, ...placed] });
    } catch (e) {
      if (e instanceof HttpError && (e.message === "err_blocked" || e.message === "generation_failed")) return;
      const msg = e instanceof HttpError && e.status === 402 ? "err_credits" : String(e instanceof Error ? e.message : e).slice(0, 500);
      await db.banner.update({ where: { id: copy.id }, data: { status: "FAILED", error: msg } }).catch(() => {});
    }
  });
  return json({ id: copy.id, pending: true });
});
