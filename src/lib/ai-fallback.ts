// Backup image generator: when OpenAI's safety filter refuses a normal sports photo (false alarms like a
// shirtless player), the poster is made with ByteDance Seedream 4 on fal.ai instead. It has its own safety
// checker, so genuinely explicit content is still refused. Needs FAL_KEY (same key as AI video).
export const fallbackReady = () => !!process.env.FAL_KEY?.trim();

/** Keeps the whole brief when it fits; if too long, keeps the start (art director's instructions) AND the end (final rules), cutting the middle. */
function fit(prompt: string, max: number) {
  if (prompt.length <= max) return prompt;
  const tail = Math.min(4000, Math.floor(max * 0.3));
  return `${prompt.slice(0, max - tail - 20)}\n\n[…]\n\n${prompt.slice(-tail)}`;
}

const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

// Keeps Nano Banana obedient about text and logos (it likes to add its own words otherwise).
const NB_SYSTEM = [
  "You are a senior sports graphic designer making a finished poster from a written brief.",
  "The brief is PRIVATE instructions for you — never write any of its wording on the image (no style names, section titles, field labels, notes like 'edition', 'sponsor', 'logo', 'dividers', 'generator', no brand names such as KIXO).",
  "TEXT: render ONLY the exact text items the brief lists, spelled letter for letter as written, each one once. Never add your own words, slogans, titles, taglines, 'edition' lines, hashtags, dates, names or numbers, and never translate, shorten or reword the user's text. If the brief gives no text for something, leave it out.",
  "LOGOS: reproduce every provided crest/logo faithfully — same letters, shapes and symbols; never rename or respell them. Only crests given as their own reference images may appear as poster elements — NEVER copy a club badge, sponsor or logo off the player's shirt in the photo into the design, and never add real club, league or brand logos on your own.",
  "PEOPLE: keep the provided person's face and identity exactly recognisable.",
  "Follow the brief's layout and style instructions precisely.",
].join(" ");

const falHeaders = () => ({ Authorization: `Key ${process.env.FAL_KEY!.trim()}`, "Content-Type": "application/json" });
const absUrls = (imageUrls: string[], max: number) => imageUrls.map((u) => (u.startsWith("/") ? site() + u : u)).filter((u) => /^https:\/\//.test(u)).slice(0, max);

async function falImage(endpoint: string, body: Record<string, unknown>, label: string, timeout = 130_000): Promise<{ buf: Buffer; url: string; status: number }> {
  const r = await fetch(`https://fal.run/${endpoint}`, { method: "POST", headers: falHeaders(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const d = (await r.json().catch(() => ({}))) as { images?: { url?: string }[]; detail?: unknown; has_nsfw_concepts?: boolean[] };
  const url = d.images?.[0]?.url;
  if (!r.ok || !url) throw Object.assign(new Error(`${label} failed: ${r.status} ${JSON.stringify(d.detail ?? d).slice(0, 200)}`), { status: r.status });
  if (d.has_nsfw_concepts?.[0]) throw new Error(`${label} refused the image`);
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error(`${label} download failed: ${img.status}`);
  return { buf: Buffer.from(await img.arrayBuffer()), url, status: r.status };
}

/** FLUX.2 Pro (Black Forest Labs) — very photoreal, multi-reference. */
export async function fluxPoster(prompt: string, imageUrls: string[], format?: string, wide?: boolean) {
  const urls = absUrls(imageUrls, 9);
  if (!urls.length) throw new Error("FLUX.2: no reference image");
  return falImage("fal-ai/flux-2-pro/edit", { prompt: fit(`${prompt}\n\n${NB_SYSTEM}`, 20000), image_urls: urls, image_size: fallbackSize(format, wide), output_format: "png", safety_tolerance: "2" }, "FLUX.2 Pro", 120_000);
}

/** FLUX.2 Pro realism pass: keeps the image identical, only makes it look like a real photo shoot. */
export async function fluxRealism(imageUrl: string, format?: string, wide?: boolean, instructions = "") {
  const prompt = [
    instructions ? `This poster was designed from these ART DIRECTOR'S DESIGN INSTRUCTIONS — read all of them and keep every point exactly as it already is in the image (layout, positions, poses, background, style); where the image differs from them, gently correct it toward them:\n${fit(instructions, 12000)}\n\n` : "",
    "Retouch this exact image. Keep EVERYTHING identical — the same composition, layout, people, faces, poses, clothing, background, crests, objects, colours and framing; do not add, remove or move anything and do not add any text.",
    "Only upgrade the REALISM so it looks like a real professional sports photo shoot composited by a top designer: real skin with pores and natural tone (no airbrushed, waxy or plastic skin), real hair strands, real fabric folds and stitching, true photographic lighting and shadows, natural lens depth of field, fine film grain, believable restrained effects. Remove any CGI, cartoon or over-smoothed AI look.",
  ].join(" ");
  return falImage("fal-ai/flux-2-pro/edit", { prompt, image_urls: [imageUrl], image_size: fallbackSize(format, wide), output_format: "png", safety_tolerance: "2" }, "FLUX.2 realism", 100_000);
}

/** Nano Banana Pro returning both the image and its fal URL (for chaining steps). */
export async function nanoBananaArt(prompt: string, imageUrls: string[], format?: string, wide?: boolean) {
  const urls = absUrls(imageUrls, 14);
  if (!urls.length) throw new Error("nano banana: no reference image");
  const aspect = format === "story" ? "9:16" : format === "banner" ? "16:9" : wide ? "3:2" : "4:5";
  return falImage("fal-ai/nano-banana-pro/edit", { prompt: fit(prompt, 30000), image_urls: urls, aspect_ratio: aspect, resolution: "2K", output_format: "png", num_images: 1, temperature: 0.7, system_prompt: NB_SYSTEM }, "Nano Banana Pro");
}

/** Google Nano Banana Pro (Gemini 3 Pro Image — the partner model inside Photoshop's Generative Fill), on fal.ai. */
export async function nanoBananaPoster(prompt: string, imageUrls: string[], format?: string, wide?: boolean): Promise<Buffer> {
  const urls = imageUrls.map((u) => (u.startsWith("/") ? site() + u : u)).filter((u) => /^https:\/\//.test(u)).slice(0, 14);
  if (!urls.length) throw new Error("nano banana: no reference image");
  const aspect = format === "story" ? "9:16" : format === "banner" ? "16:9" : wide ? "3:2" : "4:5";
  const r = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: fit(prompt, 30000), image_urls: urls, aspect_ratio: aspect, resolution: "2K", output_format: "png", num_images: 1, temperature: 0.7, system_prompt: NB_SYSTEM }),
    signal: AbortSignal.timeout(130_000),
  });
  const d = (await r.json().catch(() => ({}))) as { images?: { url?: string }[]; detail?: unknown };
  const url = d.images?.[0]?.url;
  if (!r.ok || !url) throw new Error(`Nano Banana Pro failed: ${r.status} ${JSON.stringify(d.detail ?? d).slice(0, 200)}`);
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error(`Nano Banana download failed: ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

/** Backup chain when OpenAI refuses a photo: Nano Banana Pro first, then Seedream. */
export async function backupPoster(prompt: string, imageUrls: string[], format?: string, wide?: boolean): Promise<{ buf: Buffer; model: string }> {
  try {
    return { buf: await nanoBananaPoster(prompt, imageUrls, format, wide), model: "Nano Banana Pro" };
  } catch (e) {
    try {
      return { buf: await seedreamPoster(prompt, imageUrls, fallbackSize(format, wide)), model: "Seedream" };
    } catch (e2) {
      throw new Error(`${e instanceof Error ? e.message : e} | ${e2 instanceof Error ? e2.message : e2}`);
    }
  }
}

export async function seedreamPoster(prompt: string, imageUrls: string[], size: { width: number; height: number }): Promise<Buffer> {
  // Seedream 5.0 Pro first; if that endpoint isn't available, Seedream 4.
  try {
    return (await falImage("bytedance/seedream/v5/pro/edit", { prompt: fit(prompt, 4000), image_urls: absUrls(imageUrls, 10), image_size: size, num_images: 1, enable_safety_checker: true }, "Seedream 5", 170_000)).buf;
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st !== 404 && st !== 405 && st !== 422) throw e;
  }
  const urls = imageUrls.map((u) => (u.startsWith("/") ? site() + u : u)).filter((u) => /^https:\/\//.test(u)).slice(0, 10);
  if (!urls.length) throw new Error("fallback: no reference image");
  const r = await fetch("https://fal.run/fal-ai/bytedance/seedream/v4/edit", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: fit(prompt, 4000), image_urls: urls, image_size: size, num_images: 1, enable_safety_checker: true }),
    signal: AbortSignal.timeout(170_000),
  });
  const d = (await r.json().catch(() => ({}))) as { images?: { url?: string }[]; detail?: unknown; has_nsfw_concepts?: boolean[] };
  const url = d.images?.[0]?.url;
  if (!r.ok || !url) throw new Error(`fallback (Seedream) failed: ${r.status} ${JSON.stringify(d.detail ?? d).slice(0, 200)}`);
  if (d.has_nsfw_concepts?.[0]) throw new Error("fallback (Seedream) refused the image");
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) throw new Error(`fallback download failed: ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

/** Output size for Seedream (needs ≥ 921,600 pixels). */
export function fallbackSize(format?: string, wide?: boolean) {
  if (format === "story") return { width: 1152, height: 2048 };
  if (format === "banner") return { width: 2048, height: 1152 };
  if (wide) return { width: 1536, height: 1024 };
  return { width: 1088, height: 1360 };
}
