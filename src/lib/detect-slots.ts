import { HttpError } from "./auth";
import { isStorageUrl, loadBytes, sniffImage } from "./storage";
import type { SlotOverride } from "./text-slots";

const MODELS = [process.env.OPENAI_VISION_MODEL?.trim(), process.env.OPENAI_TEXT_MODEL?.trim(), "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean) as string[];

/**
 * Reads a style's reference flyer and lists its text lines as boxes (title EN/ES, example text, where the
 * line sits and how it is lettered) — the boxes a style gets with one tap instead of typing them.
 * Throws HttpError 503 (no AI key), 400 (bad url), 422 (no text found) or 502 (AI failed).
 */
export async function detectSlotsFromImage(styleRefUrl: string): Promise<SlotOverride[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new HttpError(503, "ai_not_configured");
  if (!isStorageUrl(styleRefUrl)) throw new HttpError(400, "bad_file_url");
  const bytes = await loadBytes(styleRefUrl);
  const type = sniffImage(bytes) || "image/jpeg";
  const dataUrl = `data:${type};base64,${bytes.toString("base64")}`;

  const system = [
    "You read nightlife / sports flyers for a poster-maker app. The app recreates this flyer's design and swaps its texts for the user's own, so it needs ONE input box per text line of the flyer.",
    "List EVERY separate text line or small text block on the flyer, top to bottom, EXCEPT: the one giant main title (that becomes the player's name — skip it), logos, watermarks, designer credits, '+18 / drink responsibly' legal lines and anything blurred.",
    "For each line give: key (short snake_case, unique), label (English, 2–6 words naming the line by its role and look, e.g. 'Date block (top left)', 'Gold names (two lines)', 'Bottom address line'), labelEs (the same in Spanish), ph (the flyer's own text on that line, shortened to one example, max 60 chars), where (one sentence for an AI artist: where the line sits — top/bottom/left/right/centre and roughly how far down — and how it is lettered: font style, size, colour, 3D / outline / glow / script / letter-spaced), max (a sensible character limit, 10–110).",
    "Group text that clearly belongs together (e.g. two stacked host names) as ONE line. 3–12 lines is typical.",
    'Reply with JSON only: {"slots":[{"key":"...","label":"...","labelEs":"...","ph":"...","where":"...","max":40}, ...]}',
  ].join("\n");

  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: [{ type: "text", text: "List this flyer's text lines as boxes." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
        ],
      }),
      signal: AbortSignal.timeout(50_000),
    });
    if (res.status === 404 || res.status === 400) {
      lastErr = `${model}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
      continue;
    }
    if (!res.ok) {
      lastErr = `${res.status}`;
      break;
    }
    const data = await res.json();
    let out: { slots?: unknown } = {};
    try {
      out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch {
      /* ignore */
    }
    const seen = new Set<string>();
    const slots: SlotOverride[] = [];
    for (const s of Array.isArray(out.slots) ? out.slots : []) {
      if (!s || typeof s !== "object") continue;
      const r = s as Record<string, unknown>;
      const label = String(r.label ?? "").trim().slice(0, 60);
      if (!label) continue;
      let key =
        String(r.key ?? label)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 28) || `line${slots.length + 1}`;
      while (seen.has(key)) key = `${key.slice(0, 26)}_${slots.length + 1}`;
      seen.add(key);
      const max = Number(r.max);
      slots.push({
        key,
        custom: true,
        on: false,
        label,
        labelEs: String(r.labelEs ?? label).trim().slice(0, 60) || label,
        ph: String(r.ph ?? "").trim().slice(0, 120),
        where: String(r.where ?? "").trim().slice(0, 400),
        max: Number.isFinite(max) ? Math.min(200, Math.max(4, Math.round(max))) : 60,
      });
      if (slots.length >= 16) break;
    }
    if (!slots.length) throw new HttpError(422, "no_text_found");
    return slots;
  }
  console.error("detect-slots failed", lastErr);
  throw new HttpError(502, "ai_failed");
}
