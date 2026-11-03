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
  // ⭐ The best one: Pro model + a full hype-trailer sequence + 3 random extras.
  ultra: { en: "Ultra", es: "Ultra", prompt: "a full sports hype-trailer shot: the camera starts slightly wide and pushes in fast with strong 3D parallax and a subtle whip; the player comes alive — turns to the lens, a confident smirk, a powerful signature gesture (fist, point, arms crossed or a chest tap) — then a dramatic hero pose as the light hits him; every element of the poster animates with depth: the background moves, light changes, the title and number catch a bright metallic shine" },
  epic: { en: "Epic camera", es: "Cámara épica", prompt: "a fast, dramatic cinematic camera dolly-in toward the player with strong parallax; the player turns his head toward the camera, nods with confidence and strikes a power pose" },
  celebrate: { en: "Celebration", es: "Celebración", prompt: "the player bursts into a big celebration — jumps, pumps both fists, shouts with joy, points at the camera — while the camera shakes slightly with the energy" },
  walk: { en: "Walk-out", es: "Entrada épica", prompt: "the player walks powerfully toward the camera like a stadium walk-out, shoulders moving, the camera tracking backward in front of him" },
  orbit: { en: "360 orbit", es: "Giro 360", prompt: "the camera swings in a smooth fast arc around the player while he turns his body and looks straight into the lens" },
  fire: { en: "Fire & smoke", es: "Fuego y humo", prompt: "huge flames erupt behind the player, embers and sparks blast past the camera, the player clenches his fists and stares intensely into the lens" },
};

// Random extra action so no two videos look the same (2 are picked each time).
const EXTRAS = [
  "the whole background is alive: clouds rush across the sky in fast time-lapse",
  "lightning bolts crack across the sky and light up the scene",
  "stadium floodlights sweep and flash across the background",
  "thick smoke rolls and swirls through the background",
  "glowing embers and sparks drift and spin through the air",
  "leaves, confetti or particles from the scene swirl in a strong gust of wind",
  "lens flares and light streaks shoot across the frame",
  "the background elements of the poster move on their own — flags wave, flames flicker, objects sway",
  "a pulsing energy aura glows and ripples around the player",
  "the big number and logo glow and pulse with light, with a shimmering metallic shine sweeping across them",
  "fireworks burst in the sky behind the player",
  "rain streaks fall and splash with dramatic backlight",
  "a crowd of camera flashes pops in the dark background",
  "fog rolls along the ground and light beams cut through it",
];
const pick = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);

export async function videoPrices() {
  const s = await getSettings();
  return { on: s.video_on !== "0" && videoReady(), five: Number(s.video_cost_5) || 10, ten: Number(s.video_cost_10) || 18, model: (s.video_model as ModelKey) in VIDEO_MODELS ? (s.video_model as ModelKey) : "kling-std" };
}

/** Charges credits and sends the job to fal. Throws HttpError-like errors with a code. */
export async function startVideo(o: { userId: string; bannerId: string; imageUrl: string; seconds: 5 | 10; audio: boolean; motion: string; extra?: string }) {
  const p = await videoPrices();
  if (!p.on) throw Object.assign(new Error("video_off"), { status: 503 });
  const cost = o.seconds === 10 ? p.ten : p.five;
  const motion = MOTIONS[o.motion]?.prompt ?? MOTIONS.ultra.prompt;
  const prompt = [
    `Turn this sports poster into a dynamic, high-energy cinematic video with LOTS of visible motion — nothing stays still.`,
    `Main action: ${motion}.`,
    `Background in constant motion: ${pick(EXTRAS, o.motion === "ultra" ? 3 : 2).join("; ")}.`,
    o.extra ? `Also: ${o.extra}.` : "",
    "Style: premium sports hype trailer, dramatic lighting changes, energetic pacing, real physics, 3D depth.",
    "Keep the player's face and identity the same and keep the poster's names, numbers and logos readable.",
  ].filter(Boolean).join(" ");
  const image = o.imageUrl.startsWith("/") ? site() + o.imageUrl : o.imageUrl;
  if (cost > 0) await changeCredits({ userId: o.userId, amount: -cost, type: "GENERATION", note: `AI video (${o.seconds}s)` });
  const model: ModelKey = o.motion === "ultra" ? "kling-pro" : p.model;
  const job = await db.videoJob.create({ data: { userId: o.userId, bannerId: o.bannerId, model, prompt, seconds: o.seconds, audio: o.audio, cost } });
  try {
    const r = await fetch(`https://queue.fal.run/${VIDEO_MODELS[model].id}`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ start_image_url: image, prompt: prompt.slice(0, 2400), duration: String(o.seconds), generate_audio: o.audio, cfg_scale: 0.7, negative_prompt: "static image, frozen, still frame, slow motion, blur, distort, low quality, warped text, misspelled letters, extra fingers, face change, morphing" }),
      signal: AbortSignal.timeout(30000),
    });
    const d = (await r.json().catch(() => ({}))) as { status_url?: string; response_url?: string; detail?: unknown };
    if (!r.ok || !d.status_url) throw new Error(`fal ${r.status}: ${JSON.stringify(d.detail ?? d).slice(0, 200)}`);
    return db.videoJob.update({ where: { id: job.id }, data: { status: "running", statusUrl: d.status_url, responseUrl: d.response_url } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "start_failed";
    await fail(job.id, msg);
    throw Object.assign(new Error("video_failed"), { status: 502, detail: msg });
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
