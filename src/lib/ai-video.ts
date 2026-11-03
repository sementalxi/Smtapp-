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

// Styles = camera + scene feel. The player's FLEX is picked at random every time (see FLEXES).
export const MOTIONS: Record<string, { en: string; es: string; prompt: string }> = {
  ultra: { en: "Ultra", es: "Ultra", prompt: "a sports hype-trailer shot: the camera starts slightly wide and pushes in fast with strong 3D parallax; the title and number catch a bright metallic shine; dramatic light hits the player at the end" },
  epic: { en: "Epic camera", es: "Cámara épica", prompt: "a fast dramatic camera dolly-in toward the player with strong parallax" },
  celebrate: { en: "Celebration", es: "Celebración", prompt: "a big-match celebration moment with the camera shaking slightly from the energy" },
  walk: { en: "Walk-out", es: "Entrada épica", prompt: "a stadium walk-out: the player steps forward toward the camera while it tracks backward" },
  orbit: { en: "360 orbit", es: "Giro 360", prompt: "the camera swings in a smooth fast arc around the player" },
  fire: { en: "Fire & smoke", es: "Fuego y humo", prompt: "pyrotechnic flames burst behind the player and sparks blast past the camera" },
};

// Soccer / esports player flexes — a random one (or two in a row) every video, so no two look the same.
const FLEXES = [
  "flexes both biceps with a confident smirk",
  "crosses his arms, nods slowly and stares into the lens",
  "does the famous jump-and-turn goal celebration, landing with arms wide",
  "puts a finger to his lips in a 'shush' celebration",
  "kisses the badge on his chest, then points at the camera",
  "points both index fingers to the sky",
  "beats his chest twice and shouts with passion",
  "makes a 'calm down' gesture with both hands, cool and confident",
  "gives a military salute to the camera",
  "spreads his arms like an airplane in celebration",
  "taps his temple with one finger — big-brain play",
  "makes heart hands toward the crowd",
  "clenches both fists and roars toward the sky",
  "adjusts his gaming headset, then gives a cocky grin and a nod",
  "cracks his knuckles and rolls his shoulders, ready for the match",
  "juggles a soccer ball on his foot, then catches it and smiles",
  "rubs his hands together and smirks like he already won",
  "points to his own name on the poster with both thumbs",
  "does a slow cool head turn toward the camera and raises his chin",
  "flexes one arm and taps his bicep twice",
];

// Random scene extras (2–3 picked each time).
const EXTRAS = [
  "stadium floodlights sweep and flash across the background",
  "camera flashes from the crowd pop in the dark background",
  "neon esports stage lights pulse in the team colours",
  "LED stadium boards flicker behind the player",
  "thick smoke rolls and swirls through the background",
  "glowing embers and sparks drift through the air",
  "confetti rains down in the team colours",
  "pyrotechnic fire jets shoot up behind the player",
  "lightning cracks across the sky and lights up the scene",
  "clouds rush across the sky in fast time-lapse",
  "lens flares and light streaks shoot across the frame",
  "the big number and logo glow and pulse with light",
  "a pulsing energy aura ripples around the player",
  "rain falls in dramatic floodlight backlight",
  "fog rolls along the ground with light beams cutting through it",
  "the poster's own background elements come alive — flags wave, flames flicker, objects move",
];
const pick = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);

export async function videoPrices() {
  const s = await getSettings();
  return { on: s.video_on !== "0" && videoReady(), five: Number(s.video_cost_5) || 10, ten: Number(s.video_cost_10) || 18, audio: s.video_cost_audio === undefined || s.video_cost_audio === "" ? 5 : Number(s.video_cost_audio) || 0, model: (s.video_model as ModelKey) in VIDEO_MODELS ? (s.video_model as ModelKey) : "kling-std" };
}

/** Charges credits and sends the job to fal. Throws HttpError-like errors with a code. */
export async function startVideo(o: { userId: string; bannerId: string; imageUrl: string; seconds: 5 | 10; audio: boolean; motion: string; extra?: string }) {
  const p = await videoPrices();
  if (!p.on) throw Object.assign(new Error("video_off"), { status: 503 });
  const cost = (o.seconds === 10 ? p.ten : p.five) + (o.audio ? p.audio : 0);
  const motion = MOTIONS[o.motion]?.prompt ?? MOTIONS.ultra.prompt;
  const flexes = pick(FLEXES, o.motion === "ultra" ? 2 : 1);
  const prompt = [
    "Turn this soccer / esports player poster into a dynamic, high-energy hype video with LOTS of visible motion — nothing stays still.",
    `Camera & scene: ${motion}.`,
    `The player comes alive and ${flexes.join(", then ")}.`,
    `Background in constant motion: ${pick(EXTRAS, o.motion === "ultra" ? 3 : 2).join("; ")}.`,
    o.extra ? `Also: ${o.extra}.` : "",
    "Style: premium sports hype trailer, dramatic lighting, energetic pacing, real physics, 3D depth.",
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
    await import("./activity").then((m) => m.logActivity("site", "video", `✨ AI video started (${o.seconds}s, ${o.motion}${o.audio ? ", sound" : ""}) · ${cost} credits`)).catch(() => {});
    return db.videoJob.update({ where: { id: job.id }, data: { status: "running", statusUrl: d.status_url, responseUrl: d.response_url } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "start_failed";
    await fail(job.id, msg);
    throw Object.assign(new Error("video_failed"), { status: 502, detail: msg });
  }
}

async function fail(id: string, error: string) {
  const j = await db.videoJob.update({ where: { id }, data: { status: "failed", error: error.slice(0, 500) } });
  await import("./activity").then((m) => m.logActivity("site", "video_failed", `❌ AI video failed (refunded ${j.cost}) — ${error.slice(0, 300)}`, "error")).catch(() => {});
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
  await import("./activity").then((m) => m.logActivity("site", "video_done", `🎬 AI video ready (${j.seconds}s)`)).catch(() => {});
  return db.videoJob.update({ where: { id: j.id }, data: { status: "done", videoUrl: url } });
}

/** Finishes any running jobs (called by the cron so videos complete even if the user left). */
export async function advanceAllVideos() {
  const running = await db.videoJob.findMany({ where: { status: "running" }, select: { id: true }, take: 20 });
  for (const r of running) await advanceVideo(r.id).catch(() => {});
  return running.length;
}
