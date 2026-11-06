import { NextRequest, after } from "next/server";
import { z } from "zod";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { generatePoster } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { loadBytes, saveFile, sniffImage } from "@/lib/storage";
import { stampLogo } from "@/lib/stamp";
import { STUDIO_KINDS, STUDIO_SIZES, type StudioKind, type StudioSize } from "@/lib/studio";
import { siteUrl } from "@/lib/email-template";

// Fluid compute lets this function run up to 800 s: a High render with reference photos can take OpenAI 4–8 minutes.
export const maxDuration = 800;
const LIMIT_MS = 800_000;

const Schema = z.object({
  kind: z.enum(Object.keys(STUDIO_KINDS) as [keyof typeof STUDIO_KINDS]),
  size: z.enum(Object.keys(STUDIO_SIZES) as [keyof typeof STUDIO_SIZES]),
  quality: z.enum(["medium", "high"]).default("high"),
  prompt: z.string().trim().min(3).max(20000),
  texts: z.string().trim().max(2000).default(""),
  images: z.array(z.object({ url: z.string().min(1), role: z.string().trim().max(120).default("") })).max(6).default([]),
  stamp: z.boolean().default(false),
});

type Body = z.infer<typeof Schema>;
type Job = { status: "PENDING" | "READY" | "FAILED"; url?: string; error?: string; at: number; prompt?: string; tries?: number; body?: Body; by?: string };
const key = (id: string) => `studio_job_${id}`;
const save = (id: string, j: Job) => db.setting.upsert({ where: { key: key(id) }, create: { key: key(id), value: JSON.stringify(j) }, update: { value: JSON.stringify(j) } });

/** A job may re-run itself ONCE in a fresh function when OpenAI ran out the clock (the function limit). */
const RETRY_ERR = /abort|timeout|timed out|socket|ECONNRESET|fetch failed|terminated/i;
const jobToken = (id: string) => createHmac("sha256", process.env.AUTH_SECRET || process.env.OPENAI_API_KEY || "kixo").update(`studio:${id}`).digest("hex");

/** The whole generation, in the background. On a timeout the job hands itself to a fresh function once. */
async function runJob(id: string, b: Body, by: string, tries: number) {
  try {
    const refs: { bytes: Buffer; type: string }[] = [];
    const lines: string[] = [];
    for (const [n, im] of b.images.entries()) {
      const bytes = await loadBytes(im.url);
      const type = sniffImage(bytes) ?? "image/png";
      refs.push({ bytes, type });
      lines.push(`- Reference image ${n + 1}: ${im.role || "use it in the design"}`);
    }
    const prompt = [
      STUDIO_KINDS[b.kind as StudioKind].prompt,
      b.prompt,
      b.texts ? `TEXT ON THE DESIGN (spell exactly, nothing else):\n${b.texts}` : "",
      lines.length ? `REFERENCE IMAGES (in the order given):\n${lines.join("\n")}\nKeep people's faces and logos faithful to the references.` : "",
      `FINAL REMINDER — follow the admin's instructions above exactly: ${b.prompt.slice(0, 600)}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const sizes = [...STUDIO_SIZES[b.size as StudioSize].sizes];
    let out: Buffer | null = null;
    // Same top generator as the posters (Admin → Settings → Poster generator). The retry goes straight to OpenAI,
    // at medium quality: a "high" render that ran out the clock once would most likely do it again.
    const model = tries ? "openai" : (await getSettings()).poster_model;
    const quality = tries && b.quality === "high" ? "medium" : b.quality;
    const fb = await import("@/lib/ai-fallback");
    const t0 = Date.now();
    if (["mix", "mix3", "flux-mix", "seedream-mix"].includes(model) && fb.fallbackReady()) {
      try {
        const [w, h] = sizes[0].split("x").map(Number);
        const format = h / w > 1.5 ? "story" : w / h > 1.3 ? "banner" : "post";
        const artPrompt = `${prompt}\n\nIMPORTANT — THIS STEP IS ARTWORK ONLY: create the complete finished design exactly as described but with ABSOLUTELY NO TEXT, letters or numbers anywhere (logos keep their own artwork). Leave clean space where each text item will go.`;
        const urls = b.images.map((i) => i.url);
        let art = model === "flux-mix" ? await fb.fluxPoster(artPrompt, urls, format) : model === "seedream-mix" ? await fb.seedreamArt(artPrompt, urls, format) : await fb.nanoBananaArt(artPrompt, urls, format);
        if (model === "mix3" || model === "seedream-mix") art = await fb.fluxRealism(art.url, format, false, b.prompt).catch(() => art);
        out = b.texts
          ? await generatePoster(
              [
                `ADMIN'S INSTRUCTIONS for this design (the artwork already follows them — now place and style the text exactly as they describe):\n${b.prompt}`,
                `Reference image 1 is a finished artwork with NO TEXT yet. Keep EVERYTHING in it exactly as it is. Your only job: ADD the text below as premium typography that matches it, in the clean spaces left for it. Spell every item exactly, letter for letter, each once. Add no other words.`,
                `TEXT ON THE DESIGN (spell exactly, nothing else):\n${b.texts}`,
              ].join("\n\n"),
              [{ bytes: art.buf, type: sniffImage(art.buf) ?? "image/png" }],
              quality,
              sizes,
              LIMIT_MS - 25_000 - (Date.now() - t0),
            )
          : art.buf;
      } catch {
        out = null; // fall back to OpenAI alone (with whatever time is left)
      }
    }
    if (!out) out = await generatePoster(prompt, refs, quality, sizes, LIMIT_MS - 25_000 - (Date.now() - t0));
    if (b.stamp) out = await stampLogo(out);
    const url = await saveFile("studio", out, "image/png");
    await save(id, { status: "READY", url, at: Date.now(), prompt });
    // keep a short history
    const hist = await db.setting.findUnique({ where: { key: "studio_recent" } });
    const list: { url: string; at: number; kind: string; size: string; by: string }[] = hist ? JSON.parse(hist.value) : [];
    list.unshift({ url, at: Date.now(), kind: b.kind, size: b.size, by });
    const value = JSON.stringify(list.slice(0, 24));
    await db.setting.upsert({ where: { key: "studio_recent" }, create: { key: "studio_recent", value }, update: { value } });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).slice(0, 500);
    if (RETRY_ERR.test(msg) && tries < 1) {
      // Hand the job to a fresh function (a new window) — once.
      try {
        await save(id, { status: "PENDING", at: Date.now(), tries: tries + 1, body: b, by });
        const r = await fetch(`${siteUrl()}/api/admin/studio`, { method: "PUT", headers: { "Content-Type": "application/json", "x-kixo-job": jobToken(id) }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(10_000) });
        if (r.ok) return;
      } catch {
        /* fall through to FAILED */
      }
    }
    await save(id, { status: "FAILED", error: msg, at: Date.now() }).catch(() => {});
  }
}

/** Admin: start a free-form generation (runs in the background; poll GET ?id=). */
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const b = Schema.parse(await req.json());
  b.images.forEach((i) => assertOwnUrl(i.url));
  if (!process.env.OPENAI_API_KEY?.trim()) throw new HttpError(400, "OPENAI_API_KEY is not set");

  // Old finished jobs aren't needed (the result is in "Recent").
  db.setting.deleteMany({ where: { key: { startsWith: "studio_job_" }, NOT: { value: { contains: "PENDING" } } } }).catch(() => {});
  const id = randomUUID();
  await save(id, { status: "PENDING", at: Date.now(), tries: 0, body: b, by: admin.email });
  after(() => runJob(id, b, admin.email, 0));

  return json({ id });
});

/** Internal: a job re-running itself in a fresh function (signed with the job token). */
export const PUT = handle(async (req: NextRequest) => {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "bad_id");
  const given = req.headers.get("x-kixo-job") ?? "";
  const want = jobToken(id);
  if (given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) throw new HttpError(403, "forbidden");
  const row = await db.setting.findUnique({ where: { key: key(id) } });
  if (!row) throw new HttpError(404, "not_found");
  const job = JSON.parse(row.value) as Job;
  if (job.status !== "PENDING" || !job.body || !job.tries) throw new HttpError(409, "not_retryable");
  const body = Schema.parse(job.body);
  after(() => runJob(id, body, job.by ?? "", job.tries ?? 1));
  return json({ ok: true });
});

/** Admin: job status. */
export const GET = handle(async (req: NextRequest) => {
  await apiAdmin();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "bad_id");
  const row = await db.setting.findUnique({ where: { key: key(id) } });
  if (!row) throw new HttpError(404, "not_found");
  const job = JSON.parse(row.value) as Job;
  if (job.status === "PENDING" && Date.now() - job.at > LIMIT_MS + 30_000) return json({ status: "FAILED", error: "Timed out — try again" });
  return json({ status: job.status, url: job.url, error: job.error, at: job.at, tries: job.tries ?? 0 });
});
