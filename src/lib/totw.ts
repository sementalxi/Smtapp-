// Team of the week, made like the player cards: every one of the eleven is its OWN full KIXO player card
// (the player-card style the user picked, through the same art + text pipeline as a normal card), the
// background comes from the TOTW style with nothing on the pitch, and the cards are placed in the formation.
import sharp from "sharp";
import { db } from "./db";
import { changeCredits } from "./credits";
import { deleteFile, loadBytes, saveFile, sniffImage } from "./storage";
import { generatePoster } from "./ai";
import { getSettings } from "./settings";
import { stampLogo } from "./stamp";
import { logGeneration } from "./discord";
import { HttpError } from "./auth";
import { buildProPrompt, collectProRefs, qualityFor, type ProRef } from "./banners";
import { EMPTY_INPUTS, type BannerInputs, type TemplateStyle } from "./templates";
import { createVariation } from "./pro-options";
import { FORMATION_ROWS, parseTotwLine } from "./formations";

export type TotwTemplate = { id: string; name: string; prompt: string; style: unknown; proInstructions: string | null; styleRefUrl: string | null; randomize: boolean; layout: string; active: boolean; audience?: string | null };

export type TotwCard = { key: string; name: string; pos: string; potw: boolean; prompt: string; refs: ProRef[]; instructions: string | null };
export type TotwPlan = {
  wide: boolean;
  formation: string;
  bg: { prompt: string; refs: ProRef[]; instructions: string | null };
  cards: TotwCard[];
};

/** The player-card style the cards are made in: the one asked for, else the first active player style the user may use. */
export async function pickCardTemplate(viewer: { role?: string; isOrg?: boolean }, id?: string | null): Promise<TotwTemplate | null> {
  const { canUseTemplate } = await import("./queries");
  if (id) {
    const t = await db.template.findFirst({ where: { id, active: true, layout: "PLAYER" } });
    if (t && canUseTemplate(t, viewer)) return t as unknown as TotwTemplate;
  }
  const all = await db.template.findMany({ where: { active: true, layout: "PLAYER" }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  return (all.find((t) => canUseTemplate(t, viewer)) as unknown as TotwTemplate) ?? null;
}

/** Everything the generator needs: the background brief and one player-card brief per player (throws err_blocked like any poster). */
export function planTotw(o: { template: TotwTemplate; cardTemplate: TotwTemplate; inputs: BannerInputs; season?: string }): TotwPlan {
  const wide = /\[WIDE\]/.test(o.template.proInstructions ?? "");
  const bgInputs: BannerInputs = { ...o.inputs, playerPhotos: [] };
  const bgRefs = collectProRefs({ layout: "TOTW", inputs: bgInputs, styleRefUrl: o.template.styleRefUrl });
  const bgPrompt = buildProPrompt({
    layout: "TOTW",
    templatePrompt: o.template.prompt,
    style: o.template.style as TemplateStyle,
    inputs: bgInputs,
    refs: bgRefs,
    instructions: o.template.proInstructions,
    randomize: o.template.randomize,
    variation: createVariation(o.inputs.colorMode || "template"),
    season: o.season,
    format: wide ? "banner" : "post",
    totwBackground: true,
  });
  const lines = o.inputs.players.filter(Boolean).slice(0, 11);
  const parsed = lines.map((l, n) => ({ ...parseTotwLine(l), n, photo: o.inputs.playerPhotos?.[n] || "" }));
  const best = parsed.reduce<(typeof parsed)[number] | null>((b, c) => (c.pts !== null && (b === null || c.pts > (b.pts ?? -1)) ? c : b), null);
  const cards: TotwCard[] = parsed.map((p) => {
    const parts = p.sub.split("·").map((s) => s.trim()).filter(Boolean);
    const club = parts.find((s) => !/\d+\s*(?:pts|points|pt)\b/i.test(s) && !/^\d+$/.test(s)) ?? "";
    const inputs: BannerInputs = {
      ...EMPTY_INPUTS,
      name: p.name,
      position: p.pos,
      tagline: club,
      subtitle: p.pts !== null ? `${p.pts} PTS` : "",
      language: o.inputs.language,
      colorMode: "template",
      bgPose: "style",
      aiCopy: "off",
    };
    const refs = collectProRefs({ layout: "PLAYER", inputs, photoUrl: p.photo || null, logoUrl: null, styleRefUrl: o.cardTemplate.styleRefUrl });
    const prompt = buildProPrompt({
      layout: "PLAYER",
      templatePrompt: o.cardTemplate.prompt,
      style: o.cardTemplate.style as TemplateStyle,
      inputs,
      refs,
      instructions: o.cardTemplate.proInstructions,
      randomize: false, // all eleven in the same fixed look
      variation: createVariation("template"),
      format: "post",
      noPhoto: !p.photo,
    });
    return { key: `${p.n}`, name: p.name, pos: p.pos, potw: !!best && best.n === p.n, prompt, refs, instructions: o.cardTemplate.proInstructions };
  });
  return { wide, formation: o.inputs.formation || "4-3-3", bg: { prompt: bgPrompt, refs: bgRefs, instructions: o.template.proInstructions }, cards };
}

type Made = { buf: Buffer; model: string };

/** Makes the background and all the cards at the same time, places the cards on the pitch, saves the poster. Refunds on failure. */
export async function generateTotwForBanner(o: { bannerId: string; userId: string; cost: number; plan: TotwPlan; accent: string; regenerate?: boolean }) {
  const { plan } = o;
  if (o.cost > 0) await changeCredits({ userId: o.userId, amount: -o.cost, type: "GENERATION", bannerId: o.bannerId, note: o.regenerate ? "Team of the week — new version" : "Team of the week" });
  const summary = `TEAM OF THE WEEK — background + ${plan.cards.length} player cards made separately and placed in the ${plan.formation} formation.\n\n[BACKGROUND]\n${plan.bg.prompt}\n\n[CARD 1 of ${plan.cards.length}]\n${plan.cards[0]?.prompt ?? ""}`;
  await db.banner.update({ where: { id: o.bannerId }, data: { prompt: summary.slice(0, 40000) } }).catch(() => {});
  const started = Date.now();
  const TOTAL_MS = 268_000;
  const left = () => TOTAL_MS - (Date.now() - started);
  const clamp = (ms: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, ms));
  const stage = (s: string) => db.banner.update({ where: { id: o.bannerId }, data: { stage: s } }).catch(() => {});
  const warn = (text: string) => import("./activity").then((m) => m.logActivity("site", "totw", text, "warn")).catch(() => {});
  try {
    const [userQuality, settings, fb] = await Promise.all([qualityFor(o.userId), getSettings(), import("./ai-fallback")]);
    // Twelve images at once must all land inside the time limit: "high" (2–4 min each) would not.
    const quality = userQuality === "high" ? "medium" : userQuality;
    const useMix = ["mix", "mix3", "flux-mix", "seedream-mix", "nano-pro"].includes(settings.poster_model) && fb.fallbackReady();
    let mixFailed = "";

    const render = async (job: { prompt: string; refs: ProRef[]; instructions: string | null; sizes: string[]; format: "post" | "banner"; label: string }): Promise<Made> => {
      const refs = job.refs.filter((r) => !r.overlay);
      const images: { bytes: Buffer; type: string }[] = [];
      for (const r of refs) {
        const bytes = await loadBytes(r.url);
        images.push({ bytes, type: sniffImage(bytes) ?? "image/png" });
      }
      if (useMix) {
        // Nano Banana Pro paints the artwork (no text), OpenAI writes the exact text — the same mix as the player cards.
        try {
          const director = (job.instructions ?? "").trim().slice(0, 20000);
          const art = await fb.nanoBananaArt(
            `${job.prompt}\n\nIMPORTANT — THIS STEP IS ARTWORK ONLY: create the complete finished artwork exactly as described (people, background, crests, effects, lighting, colours, layout) but with ABSOLUTELY NO TEXT, letters, numbers or words anywhere (logos/crests keep their own artwork). Leave clean, well-composed empty space where each text item listed above will be placed. The text is added in a second step.`,
            refs.map((r) => r.url),
            job.format,
            false,
            clamp(left() - 75_000, 40_000, 150_000),
          );
          const [tw, th] = job.sizes[0].split("x").map(Number);
          const artBuf = await sharp(art.buf).resize({ width: tw, height: th, fit: "inside", withoutEnlargement: true }).png().toBuffer();
          const keep = job.prompt
            .split("\n\n")
            .filter((sec) => /^(USER CHOICES|TITLE FONT|NAMES FONT|Write generic words|TYPOGRAPHY|Typography|STRICT TEXT RULE|Text on the poster|Only write the text|You MAY add)/.test(sec.trim()))
            .join("\n\n");
          const textPrompt = [
            director ? `ART DIRECTOR'S DESIGN INSTRUCTIONS for this image (the artwork already follows them; now place and style EVERY text item exactly as they describe):\n${director}` : "",
            `Reference image 1 is a finished artwork that has NO TEXT yet. Keep EVERYTHING in it exactly as it is — the same people and faces, poses, background, crests, colours, lighting, effects, composition and framing. Do not redraw, move or restyle anything.`,
            `Your only job: ADD the text items listed below onto it, designed as premium sports typography that matches the artwork (real materials, depth, glow and shadows that fit its lighting), placed in the clean empty spaces. Text must never cover faces.`,
            keep,
            `Spell every item exactly, letter for letter, each once. Add no other words.`,
          ]
            .filter(Boolean)
            .join("\n\n");
          const tb = left() - 5_000;
          if (tb < 40_000) throw new Error("out of time before the text step");
          const buf = await generatePoster(textPrompt, [{ bytes: artBuf, type: "image/png" }], tb < 90_000 ? "medium" : quality, job.sizes, tb);
          return { buf, model: "Nano Banana Pro art + OpenAI text" };
        } catch (e) {
          mixFailed = e instanceof Error ? e.message : String(e);
        }
      }
      const tb = left() - 5_000;
      if (tb < 40_000) throw new Error(`out of time (${job.label})`);
      const buf = await generatePoster(job.prompt, images, tb < 90_000 ? "medium" : quality, job.sizes, tb);
      return { buf, model: "OpenAI GPT Image" };
    };

    await stage("cards");
    const bgJob = { prompt: plan.bg.prompt, refs: plan.bg.refs, instructions: plan.bg.instructions, sizes: plan.wide ? ["2304x1536", "1536x1024"] : ["1632x2040", "1088x1360", "1024x1536"], format: plan.wide ? ("banner" as const) : ("post" as const), label: "background" };
    const cardJob = (c: TotwCard) => ({ prompt: c.prompt, refs: c.refs, instructions: c.instructions, sizes: ["1088x1360", "1024x1536"], format: "post" as const, label: `card ${c.name}` });
    const first = await Promise.allSettled([render(bgJob), ...plan.cards.map((c) => render(cardJob(c)))]);
    let bg = first[0].status === "fulfilled" ? first[0].value : null;
    const made = new Map<string, Made>();
    const failed: { card: TotwCard; error: string }[] = [];
    plan.cards.forEach((c, i) => {
      const r = first[i + 1];
      if (r.status === "fulfilled") made.set(c.key, r.value);
      else failed.push({ card: c, error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    });
    if (first[0].status === "rejected") failed.unshift({ card: { ...plan.cards[0], key: "bg", name: "background", prompt: plan.bg.prompt, refs: plan.bg.refs, instructions: plan.bg.instructions }, error: first[0].reason instanceof Error ? first[0].reason.message : String(first[0].reason) });
    // One more go for whatever failed, while there is time.
    if (failed.length && left() > 95_000) {
      await warn(`⚠️ Team of the week: ${failed.length} of ${plan.cards.length + 1} images failed, trying again — ${failed[0].error.slice(0, 160)}`);
      const again = await Promise.allSettled(failed.map((f) => (f.card.key === "bg" ? render(bgJob) : render(cardJob(f.card)))));
      again.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        if (failed[i].card.key === "bg") bg = r.value;
        else made.set(failed[i].card.key, r.value);
      });
    }
    if (!bg) throw new Error(`The background failed: ${failed.find((f) => f.card.key === "bg")?.error ?? "unknown"}`);
    const missing = plan.cards.filter((c) => !made.has(c.key));
    if (missing.length) throw new Error(`${missing.length} of ${plan.cards.length} player cards failed (${missing.map((c) => c.name).join(", ")}): ${failed.find((f) => f.card.key !== "bg")?.error ?? "unknown"}`);
    if (mixFailed) await warn(`⚠️ Team of the week: the Nano Banana mix failed for some images — those were made with OpenAI alone: ${mixFailed.slice(0, 160)}`);

    await stage("finishing");
    const poster = await composeTotw({ bg: bg.buf, cards: plan.cards.map((c) => ({ ...c, buf: made.get(c.key)!.buf })), formation: plan.formation, wide: plan.wide, accent: o.accent });
    const out = await stampLogo(poster, []);
    const url = await saveFile("banners", out, "image/png");
    const models = new Set([bg.model, ...[...made.values()].map((m) => m.model)]);
    const old = await db.banner.findUnique({ where: { id: o.bannerId }, select: { finalUrl: true } });
    const updated = await db.banner.update({
      where: { id: o.bannerId },
      data: { status: "READY", error: null, stage: null, finalUrl: url, prompt: `[Made with: Team of the week composite · ${[...models].join(" / ")}]\n\n${summary}`.slice(0, 40000) },
    });
    if (old?.finalUrl && old.finalUrl !== url) await deleteFile(old.finalUrl).catch(() => {});
    await logGeneration({ bannerId: o.bannerId, userId: o.userId, cost: o.cost, ok: true, regenerate: o.regenerate, image: out });
    {
      const { postShowcase } = await import("./discord-logs");
      await postShowcase({ bannerId: o.bannerId, userId: o.userId, image: out });
    }
    return updated;
  } catch (err) {
    console.error("team of the week failed", err);
    if (o.cost > 0) await changeCredits({ userId: o.userId, amount: o.cost, type: "REFUND", bannerId: o.bannerId, note: "Automatic refund — Team of the week failed" });
    const msg = String(err instanceof Error ? err.message : err).slice(0, 500);
    await logGeneration({ bannerId: o.bannerId, userId: o.userId, cost: o.cost, ok: false, regenerate: o.regenerate, error: msg });
    try {
      const { providerOutage, alertAdminsOutage } = await import("./ai-alerts");
      const kind = providerOutage(msg);
      if (kind) await alertAdminsOutage(kind, msg);
    } catch {
      /* never block the refund path */
    }
    await db.banner.update({ where: { id: o.bannerId }, data: { status: "FAILED", error: msg, stage: null } });
    if (/moderation|safety|content_policy/i.test(msg)) throw Object.assign(new HttpError(400, "err_blocked"), { detail: msg });
    throw new HttpError(502, "generation_failed");
  }
}

// ─── Placing the cards on the pitch ───

const esc = (s: string) => s.replace(/[^#0-9a-zA-Z(),.% ]/g, "");

/** Cards in formation rows (goalkeeper row first), each row left to right as seen on the graphic. */
function arrange(cards: (TotwCard & { buf: Buffer })[], formation: string) {
  const rows = FORMATION_ROWS[formation];
  if (!rows) {
    // Unknown formation: goalkeeper alone at the bottom, the rest in rows of up to four.
    const gk = cards.filter((c) => c.pos === "GK").slice(0, 1);
    const rest = cards.filter((c) => !gk.includes(c));
    const out: (TotwCard & { buf: Buffer })[][] = gk.length ? [gk] : [];
    for (let i = 0; i < rest.length; i += 4) out.push(rest.slice(i, i + 4));
    return out;
  }
  const used = new Set<string>();
  const pick = (pos: string) => {
    const c = cards.find((x) => !used.has(x.key) && x.pos === pos);
    if (c) used.add(c.key);
    return c ?? null;
  };
  // Rows are stored right-to-left (RB first); on the graphic the right back stands on the right.
  const placed = rows.map((r) => [...r].reverse().map((pos) => pick(pos)));
  // Cards whose position didn't match a spot fill the empty spots, then extra rows.
  const leftovers = cards.filter((c) => !used.has(c.key));
  for (const row of placed) for (let i = 0; i < row.length && leftovers.length; i++) if (!row[i]) row[i] = leftovers.shift()!;
  const out = placed.map((row) => row.filter((c): c is TotwCard & { buf: Buffer } => !!c)).filter((row) => row.length);
  while (leftovers.length) out.push(leftovers.splice(0, 4));
  return out;
}

async function cardLayer(buf: Buffer, w: number, h: number, accent: string, potw: boolean) {
  const r = Math.round(w * 0.07);
  const stroke = Math.max(3, Math.round(w * (potw ? 0.022 : 0.014)));
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
  const border = Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="${stroke / 2}" y="${stroke / 2}" width="${w - stroke}" height="${h - stroke}" rx="${r}" ry="${r}" fill="none" stroke="${esc(potw ? "#ffffff" : accent)}" stroke-width="${stroke}" opacity="${potw ? 0.95 : 0.85}"/></svg>`,
  );
  const card = await sharp(buf)
    .resize(w, h, { fit: "cover", position: "centre" })
    .composite([
      { input: mask, blend: "dest-in" },
      { input: border, blend: "over" },
    ])
    .png()
    .toBuffer();
  // Soft shadow under the card.
  const pad = Math.round(w * 0.25);
  const shadow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(`<svg width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#000" fill-opacity="0.65"/></svg>`), blend: "over" }])
    .blur(Math.max(8, Math.round(w * 0.06)))
    .png()
    .toBuffer();
  return { card, shadow, pad };
}

type Overlay = { input: Buffer; left: number; top: number };

/** An overlay cropped to the canvas (sharp wants every layer inside the image). */
async function clip(input: Buffer, left: number, top: number, W: number, H: number): Promise<Overlay | null> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(W, left + w);
  const y1 = Math.min(H, top + h);
  if (x1 <= x0 || y1 <= y0) return null;
  if (x0 === left && y0 === top && x1 === left + w && y1 === top + h) return { input, left, top };
  const cropped = await sharp(input).extract({ left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  return { input: cropped, left: x0, top: y0 };
}

/** The background with the eleven cards standing in the formation (goalkeeper at the bottom). */
export async function composeTotw(o: { bg: Buffer; cards: (TotwCard & { buf: Buffer })[]; formation: string; wide: boolean; accent: string }) {
  const W = o.wide ? 2304 : 1632;
  const H = o.wide ? 1536 : 2040;
  const base = await sharp(o.bg).resize(W, H, { fit: "cover" }).png().toBuffer();
  const rows = arrange(o.cards, o.formation);
  if (!rows.length) return base;
  // Where the cards go: the pitch area the background keeps clean.
  const area = o.wide ? { x: Math.round(W * 0.4), y: Math.round(H * 0.05), w: Math.round(W * 0.58), h: Math.round(H * 0.9) } : { x: Math.round(W * 0.04), y: Math.round(H * 0.21), w: Math.round(W * 0.92), h: Math.round(H * 0.77) };
  const R = rows.length;
  const rowH = area.h / R;
  const across = Math.max(...rows.map((r) => r.length));
  const gap = Math.round(W * 0.012);
  const cardW = Math.floor(Math.min((area.w - gap * (across - 1)) / across, (rowH * 0.95) / 1.25));
  const cardH = Math.round(cardW * 1.25);
  const layers: Overlay[] = [];
  const top: Overlay[] = [];
  for (let ri = 0; ri < R; ri++) {
    const row = rows[ri];
    const cy = area.y + area.h - rowH * (ri + 0.5); // row 0 = goalkeeper = bottom
    const totalW = row.length * cardW + (row.length - 1) * gap;
    const x0 = area.x + (area.w - totalW) / 2;
    for (let ci = 0; ci < row.length; ci++) {
      const c = row[ci];
      const scale = c.potw ? 1.1 : 1;
      const w = Math.round(cardW * scale);
      const h = Math.round(cardH * scale);
      const x = Math.round(x0 + ci * (cardW + gap) + (cardW - w) / 2);
      const y = Math.round(cy - h / 2);
      const { card, shadow, pad } = await cardLayer(c.buf, w, h, o.accent, c.potw);
      const sh = await clip(shadow, x - pad + Math.round(w * 0.03), y - pad + Math.round(h * 0.05), W, H);
      if (sh) layers.push(sh);
      const cd = await clip(card, x, y, W, H);
      if (cd) top.push(cd);
    }
  }
  return sharp(base).composite([...layers, ...top]).png().toBuffer();
}
