import sharp from "sharp";

// Categories that OpenAI's image model will refuse anyway — reject these at upload.
const BLOCK = ["sexual", "sexual/minors", "violence/graphic", "self-harm", "self-harm/intent", "self-harm/instructions"];

/**
 * Checks an image with OpenAI's free moderation model. Returns the blocked category,
 * or null if it's fine. Fails open (returns null) if the check itself can't run.
 */
export async function imageBlockedReason(bytes: Buffer): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  try {
    const small = await sharp(bytes).rotate().resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer();
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${small.toString("base64")}` } }],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { categories?: Record<string, boolean> }[] };
    const cats = data.results?.[0]?.categories ?? {};
    return BLOCK.find((c) => cats[c]) ?? null;
  } catch {
    return null;
  }
}
