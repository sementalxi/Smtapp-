import { createHash } from "crypto";
import { db } from "./db";
import { isStorageUrl, loadBytes, sniffImage } from "./storage";

const MODELS = [process.env.OPENAI_VISION_MODEL?.trim(), process.env.OPENAI_TEXT_MODEL?.trim(), "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean) as string[];

/**
 * A short, precise inventory of a crest (every letter and word spelled out, every symbol, the arrangement,
 * shapes and colours) so the image model can rebuild it as a 3D emblem without dropping parts.
 * Cached per file (Setting "crestdesc:<hash>"). Returns null when the AI is not configured or fails.
 */
export async function describeCrest(url: string | null | undefined): Promise<string | null> {
  if (!url || !isStorageUrl(url)) return null;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const cacheKey = `crestdesc:${createHash("sha1").update(url).digest("hex").slice(0, 24)}`;
  try {
    const hit = await db.setting.findUnique({ where: { key: cacheKey }, select: { value: true } });
    if (hit?.value) return hit.value === "-" ? null : hit.value;
  } catch {}
  let text: string | null = null;
  try {
    const bytes = await loadBytes(url);
    const type = sniffImage(bytes) || "image/png";
    const dataUrl = `data:${type};base64,${bytes.toString("base64")}`;
    const system = [
      "You describe a team crest / logo for an artist who must reproduce it EXACTLY as a 3D emblem. Be precise and complete, in one paragraph of at most 70 words, no commentary.",
      "Cover, in this order: (1) every letter and word on it, spelled exactly, with its lettering style; (2) every symbol, object or figure; (3) the arrangement — what sits where and what overlaps what; (4) the outer shape (circle, shield, square, free-standing letters…); (5) the colours of each part. If the file has a flat solid background square, say so and note that it is NOT part of the logo.",
    ].join("\n");
    for (const model of MODELS) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            { role: "system", content: system },
            { role: "user", content: [{ type: "text", text: "Describe this crest." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404 || res.status === 400) continue;
      if (!res.ok) break;
      const data = await res.json();
      const out = String(data.choices?.[0]?.message?.content ?? "").trim().replace(/\s+/g, " ");
      if (out) {
        text = out.slice(0, 600);
        break;
      }
    }
  } catch (e) {
    console.error("describeCrest failed", e);
  }
  try {
    await db.setting.upsert({ where: { key: cacheKey }, create: { key: cacheKey, value: text ?? "-" }, update: { value: text ?? "-" } });
  } catch {}
  return text;
}
