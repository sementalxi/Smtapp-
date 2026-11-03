// Backup image generator: when OpenAI's safety filter refuses a normal sports photo (false alarms like a
// shirtless player), the poster is made with ByteDance Seedream 4 on fal.ai instead. It has its own safety
// checker, so genuinely explicit content is still refused. Needs FAL_KEY (same key as AI video).
export const fallbackReady = () => !!process.env.FAL_KEY?.trim();

const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

export async function seedreamPoster(prompt: string, imageUrls: string[], size: { width: number; height: number }): Promise<Buffer> {
  const urls = imageUrls.map((u) => (u.startsWith("/") ? site() + u : u)).filter((u) => /^https:\/\//.test(u)).slice(0, 10);
  if (!urls.length) throw new Error("fallback: no reference image");
  const r = await fetch("https://fal.run/fal-ai/bytedance/seedream/v4/edit", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, 4000), image_urls: urls, image_size: size, num_images: 1, enable_safety_checker: true }),
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
