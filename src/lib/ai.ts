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
export async function generatePoster(prompt: string, refs: { bytes: Buffer; type: string }[]): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.PRO_IMAGE_MODEL || "gpt-image-2";
  const quality = process.env.PRO_IMAGE_QUALITY || "medium";
  const size = process.env.PRO_IMAGE_SIZE || "1088x1360"; // 4:5, multiples of 16

  // Stop before the 300 s function limit so a failure can still be refunded.
  const signal = AbortSignal.timeout(270_000);
  let res: Response;
  if (refs.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    refs.forEach((r, i) => {
      const ext = r.type === "image/png" ? "png" : r.type === "image/webp" ? "webp" : "jpg";
      form.append("image[]", new Blob([new Uint8Array(r.bytes)], { type: r.type }), `ref${i}.${ext}`);
    });
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality }),
      signal,
    });
  }
  if (!res.ok) throw new Error(`OpenAI image failed: ${res.status} ${(await res.text()).slice(0, 400)}`);
  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const item = data.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return download(item.url);
  throw new Error("OpenAI returned no image");
}
