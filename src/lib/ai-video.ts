// AI video: turns a finished poster into a short moving clip with Kling 3.0 (via fal.ai).
// Needs FAL_KEY on Vercel. Price per video is set in Admin → Settings (credits for 5s / 10s).
import { db } from "./db";
import { changeCredits } from "./credits";
import { saveFile } from "./storage";
import { getSettings } from "./settings";

export const videoReady = () => !!process.env.FAL_KEY?.trim();
export const VIDEO_MODELS = {
  "kling-std": { id: "fal-ai/kling-video/v3/standard/image-to-video", name: "Kling 3.0" },
  "kling-pro": { id: "fal-ai/kling-video/v3/pro/image-to-video", name: "Kling 3.0 Pro" },
} as const;
type ModelKey = keyof typeof VIDEO_MODELS;

const auth = () => ({ Authorization: `Key ${process.env.FAL_KEY!.trim()}`, "Content-Type": "application/json" });
const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

export const MOTIONS: Record<string, { en: string; es: string; prompt: string }> = {
  epic: { en: "Epic camera", es: "Cámara épica", prompt: "slow cinematic camera push-in toward the player, subtle parallax depth, stadium lights flicker, dust and sparks drift through the air" },
  celebrate: { en: "Celebration", es: "Celebración", prompt: "the player comes alive and celebrates with confident energy, arms up, fists clenched, crowd lights flashing, confetti falling" },
  walk: { en: "Walk-out", es: "Entrada épica", prompt: "the player walks confidently toward the camera like a stadium walk-out, smoke rolls across the floor, spotlights sweep" },
  orbit: { en: "360 orbit", es: "Giro 360", prompt: "the camera slowly orbits around the player in a smooth arc, dramatic rim lighting, particles swirl" },
  fire: { en: "Fire & smoke", es: "Fuego y humo", prompt: "flames and embers rise around the player, thick smoke swirls, the player looks up intensely into the camera" },
};

export async function videoPrices() {
  const s = await getSettings();
  return { on: s.video_on !== "0" && videoReady(), five: Number(s.video_cost_5) || 10, ten: Number(s.video_cost_10) || 18, model: (s.video_model as ModelKey) in VIDEO_MODELS ? (s.video_model as ModelKey) : "kling-std" };
}

/** Charges credits and sends the job to fal. Throws HttpError-like errors with a code. */
export async function startVideo(o: { userId: string; bannerId: string; imageUrl: string; seconds: 5 | 10; audio: boolean; motion: string; extra?: string }) {
  const p = await videoPrices();
  if (!p.on) throw Object.assign(new Error("video_off"), { status: 503 });
  const cost = o.seconds === 10 ? p.ten : p.five;
  const motion = MOTIONS[o.motion]?.prompt ?? MOTIONS.epic.prompt;
  const prompt = [
    `Bring this sports poster to life as a premium cinematic social media clip: ${motion}.`,
    o.extra ? `Extra direction: ${o.extra}.` : "",
    "Keep all the poster's text, names, numbers and logos sharp, readable and unchanged; keep the player's face and identity exactly the same; smooth realistic motion, high detail, no morphing.",
  ].filter(Boolean).join(" ");
  const image = o.imageUrl.startsWith("/") ? site() + o.imageUrl : o.imageUrl;
  if (cost > 0) await changeCredits({ userId: o.userId, amount: -cost, type: "GENERATION", note: `AI video (${o.seconds}s)` });
  const job = await db.videoJob.create({ data: { userId: o.userId, bannerId: o.bannerId, model: p.model, prompt, seconds: o.seconds, audio: o.audio, cost } });
  try {
    const r = await fetch(`https://queue.fal.run/${VIDEO_MODELS[p.model].id}`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ start_image_url: image, prompt: prompt.slice(0, 2400), duration: String(o.seconds), generate_audio: o.audio, negative_prompt: "blur, distort, low quality, warped text, misspelled letters, extra fingers, face change, morphing" }),
      signal: AbortSignal.timeout(30000),
    });
    const d = (await r.json().catch(() => ({}))) as { status_url?: string; response_url?: string; detail?: unknown };
    if (!r.ok || !d.status_url) throw new Error(`fal ${r.status}: ${JSON.stringify(d.detail ?? d).slice(0, 200)}`);
    return db.videoJob.update({ where: { id: job.id }, data: { status: "running", statusUrl: d.status_url, responseUrl: d.response_url } });
  } catch (e) {
    await fail(job.id, e instanceof Error ? e.message : "start_failed");
    throw Object.assign(new Error("video_failed"), { status: 502 });
  }
}

async function fail(id: string, error: string) {
  const j = await db.videoJob.update({ where: { id }, data: { status: "failed", error: error.slice(0, 500) } });
  if (j.cost > 0) await changeCredits({ userId: j.userId, amount: j.cost, type: "REFUND", note: "Automatic refund — AI video failed" }).catch(() => {});
  return j;
}

/** Checks a running job; when finished, saves the video on KIXO. Safe to call often. */
export async function advanceVideo(id: string) {
  const j = await db.videoJob.findUnique({ where: { id } });
  if (!j || j.status !== "running" || !j.statusUrl) return j;
  // Give up after 20 minutes.
  if (Date.now() - j.createdAt.getTime() > 20 * 60_000) return fail(j.id, "timed out");
  const st = await fetch(j.statusUrl, { headers: auth(), signal: AbortSignal.timeout(15000) }).then((r) => r.json()).catch(() => null) as { status?: string } | null;
  if (!st?.status || st.status === "IN_QUEUE" || st.status === "IN_PROGRESS") return j;
  const res = await fetch(j.responseUrl ?? `${j.statusUrl.replace(/\/status$/, "")}`, { headers: auth(), signal: AbortSignal.timeout(20000) });
  const out = (await res.json().catch(() => ({}))) as { video?: { url?: string }; detail?: unknown };
  if (!res.ok || !out.video?.url) {
    const msg = JSON.stringify(out.detail ?? out).slice(0, 300);
    return fail(j.id, /content|safety|policy|nsfw/i.test(msg) ? `blocked: ${msg}` : `fal: ${msg}`);
  }
  // Keep our own copy (fal links expire).
  let url = out.video.url;
  try {
    const v = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (v.ok) url = await saveFile("videos", Buffer.from(await v.arrayBuffer()), "video/mp4");
  } catch {}
  return db.videoJob.update({ where: { id: j.id }, data: { status: "done", videoUrl: url } });
}

/** Finishes any running jobs (called by the cron so videos complete even if the user left). */
export async function advanceAllVideos() {
  const running = await db.videoJob.findMany({ where: { status: "running" }, select: { id: true }, take: 20 });
  for (const r of running) await advanceVideo(r.id).catch(() => {});
  return running.length;
}
