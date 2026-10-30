// AI helpers: background image generation + player background removal.
// Uses plain fetch so there is no SDK version to keep in sync.

const REPLICATE = "https://api.replicate.com/v1";

function replicateHeaders(extra: Record<string, string> = {}) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");
  return { Authorization: `Bearer ${token}`, ...extra };
}

/** Uploads bytes to Replicate's file store so models can read them (works for any size). */
async function replicateUpload(bytes: Buffer, contentType: string): Promise<string> {
  const form = new FormData();
  form.append("content", new Blob([new Uint8Array(bytes)], { type: contentType }), "input.png");
  const res = await fetch(`${REPLICATE}/files`, { method: "POST", headers: replicateHeaders(), body: form });
  if (!res.ok) throw new Error(`Replicate upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { urls?: { get?: string } };
  if (!data.urls?.get) throw new Error("Replicate upload returned no URL");
  return data.urls.get;
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
  urls?: { get?: string };
}

/**
 * Runs a model. `model` is "owner/name" (latest version) or "owner/name:version".
 */
async function replicateRun(model: string, input: Record<string, unknown>): Promise<unknown> {
  // Stay under the 60 s serverless limit so failures can still be refunded.
  const deadline = Date.now() + 50_000;
  const [ref, pinned] = model.split(":");
  const headers = replicateHeaders({ "Content-Type": "application/json", Prefer: "wait=30" });
  const post = (url: string, body: Record<string, unknown>) =>
    fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  let res: Response;
  if (pinned) {
    res = await post(`${REPLICATE}/predictions`, { version: pinned, input });
  } else {
    // Official models run by name. Community models need their latest version id.
    res = await post(`${REPLICATE}/models/${ref}/predictions`, { input });
    if (res.status === 404 || res.status === 422) {
      const info = await fetch(`${REPLICATE}/models/${ref}`, { headers: replicateHeaders() });
      const latest = info.ok ? ((await info.json()) as { latest_version?: { id?: string } }).latest_version?.id : undefined;
      if (!latest) throw new Error(`Replicate model ${ref} not found`);
      res = await post(`${REPLICATE}/predictions`, { version: latest, input });
    }
  }
  if (!res.ok) throw new Error(`Replicate ${model} failed: ${res.status} ${await res.text()}`);
  let p = (await res.json()) as Prediction;

  // Poll if it did not finish within the wait window.
  while ((p.status === "starting" || p.status === "processing") && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(p.urls?.get ?? `${REPLICATE}/predictions/${p.id}`, { headers: replicateHeaders() });
    p = (await poll.json()) as Prediction;
  }
  if (p.status !== "succeeded") {
    if (p.status === "starting" || p.status === "processing") {
      fetch(`${REPLICATE}/predictions/${p.id}/cancel`, { method: "POST", headers: replicateHeaders() }).catch(() => {});
      throw new Error(`Replicate ${model}: timed out`);
    }
    throw new Error(`Replicate ${model}: ${p.status} ${p.error ?? ""}`);
  }
  return p.output;
}

function firstUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  if (output && typeof output === "object") {
    for (const v of Object.values(output as Record<string, unknown>)) {
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
  }
  throw new Error("Model returned no image URL");
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Public API ─────────────────────────────────────────────

export const BLOCKED = /\b(nude|naked|nsfw|sex|sexy|porn|lingerie|bikini|topless|gore|blood|kill|nazi|swastika)\b/i;

export function buildPrompt(templatePrompt: string, extra?: string) {
  const clean = (extra ?? "").replace(/[^\p{L}\p{N}\s,.\-']/gu, " ").slice(0, 200).trim();
  if (clean && BLOCKED.test(clean)) throw new Error("prompt_blocked");
  return [
    templatePrompt,
    clean,
    "background only, empty center area for a person to be placed later",
    "no people, no faces, no text, no letters, no logos, no watermark",
    "ultra detailed sports poster background, 4k, dramatic lighting",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Generates a 4:5 portrait background. Returns PNG/JPEG/WebP bytes. */
/** Which service paints Quick-mode backgrounds: Replicate when its token is set, otherwise OpenAI. */
export const backgroundProvider = () =>
  process.env.AI_PROVIDER === "openai" || (!process.env.REPLICATE_API_TOKEN?.trim() && process.env.OPENAI_API_KEY?.trim())
    ? "openai"
    : process.env.REPLICATE_API_TOKEN
      ? "replicate"
      : null;

/** Background removal needs Replicate; without it the photo is used as-is. */
export const canRemoveBackground = () => !!process.env.REPLICATE_API_TOKEN;

export async function generateBackground(prompt: string): Promise<Buffer> {
  if (backgroundProvider() === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL || process.env.PRO_IMAGE_MODEL || "gpt-image-2",
        prompt,
        size: "1088x1360",
        quality: "low", // backgrounds don't need much detail; low is fast (~20 s)
      }),
      signal: AbortSignal.timeout(270_000),
    });
    if (!res.ok) throw new Error(`OpenAI image failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = data.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item?.url) return download(item.url);
    throw new Error("OpenAI returned no image");
  }

  const output = await replicateRun(process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell", {
    prompt,
    aspect_ratio: "4:5",
    output_format: "png",
    num_outputs: 1,
  });
  return download(firstUrl(output));
}

/** Removes the background of a person photo. Returns transparent PNG bytes. */
export async function removeBackground(photo: Buffer, contentType: string): Promise<Buffer> {
  const url = await replicateUpload(photo, contentType);
  const output = await replicateRun(process.env.REPLICATE_REMBG_MODEL || "851-labs/background-remover", {
    image: url,
    format: "png",
  });
  return download(firstUrl(output));
}

// ─── Pro AI mode: the model designs the whole poster ───────

export const proConfigured = () => !!process.env.OPENAI_API_KEY?.trim();

/**
 * Full-poster generation with OpenAI's image model, using the player photo
 * (and logo) as reference images. Returns PNG bytes.
 */
export async function generatePoster(prompt: string, refs: { bytes: Buffer; type: string }[], qualityOverride?: string, sizesOverride?: string[]): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.PRO_IMAGE_MODEL || "gpt-image-2";
  const quality = (["low", "medium", "high"].includes(qualityOverride ?? "") ? qualityOverride : null) ?? process.env.PRO_IMAGE_QUALITY ?? "medium";
  // First try an exact 4:5 size; if OpenAI's servers choke, retry with the standard portrait size.
  const sizes = sizesOverride?.length ? sizesOverride : [process.env.PRO_IMAGE_SIZE || "1088x1360", "1024x1536"];
  // OpenAI's image prompt limit is 32,000 characters.
  if (prompt.length > 31_900) prompt = prompt.slice(0, 31_900);
  const deadline = Date.now() + 270_000; // stay under the 300 s function limit so failures can be refunded

  let lastErr = "";
  let sizeIdx = 0;
  let soft = 0; // after a safety block: 1 = toned-down wording, 2 = also drop the art director's and user's extra text
  let lowModeration = true; // ask for OpenAI's less strict filter (dropped if the API doesn't accept it)
  for (let attempt = 0; attempt < 4; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 45_000) break;
    try {
      const res = await callImageApi(key, model, soft === 0 ? prompt : softenPrompt(soft === 2 ? stripOptional(prompt) : prompt), sizes[sizeIdx], quality, refs, AbortSignal.timeout(remaining), lowModeration);
      if (res.ok) {
        const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
        const item = data.data?.[0];
        if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
        if (item?.url) return download(item.url);
        lastErr = "OpenAI returned no image";
        continue;
      }
      const body = await res.text();
      lastErr = `OpenAI image failed: ${res.status} ${cleanError(body)}`;
      if (res.status === 400 && lowModeration && /moderation/i.test(body) && /unknown|unsupported|invalid/i.test(body) && !/moderation_blocked/i.test(body)) {
        lowModeration = false; // this endpoint doesn't take the setting — just retry without it
        continue;
      }
      if (/moderation_blocked|safety system/i.test(body)) {
        if (soft >= 2) break;
        soft++;
        continue;
      }
      // other 4xx = our request/key problem: retrying won't help
      if (res.status < 500 && res.status !== 429) break;
      sizeIdx = Math.min(sizeIdx + 1, sizes.length - 1);
    } catch (e) {
      lastErr = `OpenAI image failed: ${e instanceof Error ? e.message : String(e)}`;
      sizeIdx = Math.min(sizeIdx + 1, sizes.length - 1);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(lastErr || "OpenAI image failed");
}

function callImageApi(
  key: string,
  model: string,
  prompt: string,
  size: string,
  quality: string,
  refs: { bytes: Buffer; type: string }[],
  signal: AbortSignal,
  lowModeration = false,
) {
  if (!refs.length) {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality, ...(lowModeration ? { moderation: "low" } : {}) }),
      signal,
    });
  }
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", quality);
  if (lowModeration) form.append("moderation", "low");
  refs.forEach((r, i) => {
    const ext = r.type === "image/png" ? "png" : r.type === "image/webp" ? "webp" : "jpg";
    form.append("image[]", new Blob([new Uint8Array(r.bytes)], { type: r.type }), `ref${i}.${ext}`);
  });
  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal,
  });
}

/** Turns an API error body (JSON or an HTML error page) into one short readable line. */
function cleanError(body: string) {
  try {
    const j = JSON.parse(body) as { error?: { message?: string; code?: string } };
    if (j.error?.message) return `${j.error.code ? j.error.code + ": " : ""}${j.error.message}`.slice(0, 300);
  } catch {
    /* not JSON */
  }
  const title = body.match(/<title>([^<]*)<\/title>/i)?.[1];
  return (title || body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim().slice(0, 200);
}

/**
 * OpenAI's safety filter sometimes blocks harmless sports posters because of
 * dramatic wording. This tones those words down for one retry.
 */
const SOFTEN: [RegExp, string][] = [
  [/\b(violent|violently|brutal|savage|vicious)\b/gi, "dramatic"],
  [/\b(aggressive|aggression|angry|furious|fury|rage|menacing|intimidating)\b/gi, "bold"],
  [/\b(explosions?|exploding|explode|blast|detonat\w*)\b/gi, "burst of light"],
  [/\b(blood|bloody|gore|wounds?)\b/gi, "crimson"],
  [/\b(kill\w*|murder\w*|dead|death|deadly|lethal)\b/gi, "legendary"],
  [/\b(war|battle|warrior|weapons?|guns?|rifles?|bullets?|swords?|knife|knives)\b/gi, "competition"],
  [/\b(pyro flares?|pyro|riot|ultras in full fury)\b/gi, "stadium lights"],
  [/\b(shattered|smash\w*|destroy\w*|crush\w*)\b/gi, "sparkling"],
  [/\b(skulls?|demons?|devil|hell|evil)\b/gi, "dark"],
  [/\b(sexy|seductive|nude|naked)\b/gi, "stylish"],
];

export function softenPrompt(prompt: string) {
  let out = prompt;
  for (const [re, rep] of SOFTEN) out = out.replace(re, rep);
  return `${out}\n\nThis is a friendly, family-safe sports and esports celebration poster: no violence, weapons or gore.`;
}

/** Removes the optional free-text sections (art director instructions, user's extra idea) for a last safe retry. */
function stripOptional(prompt: string) {
  return prompt
    .split("\n\n")
    .filter((sec) => !/^DESIGN INSTRUCTIONS FROM THE ART DIRECTOR|^Extra direction from the user/.test(sec.trim()))
    .join("\n\n");
}
