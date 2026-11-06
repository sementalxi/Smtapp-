// When OpenAI's image safety filter rejects a request, this asks OpenAI's moderation endpoint about each input on
// its own (the prompt, the text lines, each reference picture) so the admin learns WHICH one it objects to and can
// swap it — instead of a bare "rejected by the safety system". Diagnosis only: nothing is softened or retried here.
import sharp from "sharp";

export type FlagHit = { what: string; categories: string[] };

type ModerationResult = { flagged?: boolean; categories?: Record<string, boolean>; category_scores?: Record<string, number> };

export async function explainModeration(parts: { what: string; text?: string; image?: Buffer }[]): Promise<FlagHit[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return [];
  const out: FlagHit[] = [];
  await Promise.all(
    parts.map(async (p) => {
      try {
        if (!p.image && !p.text?.trim()) return;
        const input = p.image
          ? [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${(await sharp(p.image).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString("base64")}` } }]
          : [{ type: "text", text: (p.text ?? "").slice(0, 10_000) }];
        const res = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "omni-moderation-latest", input }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: ModerationResult[] };
        const r = data.results?.[0];
        if (!r) return;
        // The image filter is stricter than the moderation endpoint: anything scoring high is worth naming, flagged or not.
        const cats = Object.entries(r.category_scores ?? {})
          .filter(([k, v]) => r.categories?.[k] || v >= 0.35)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k.replace(/_/g, " ")} ${Math.round(v * 100)}%`);
        if (r.flagged || cats.length) out.push({ what: p.what, categories: cats.slice(0, 3) });
      } catch {
        /* diagnosis only */
      }
    }),
  );
  return out;
}

/** One line for the admin: what the filter most likely objected to. */
export function moderationAdvice(hits: FlagHit[], es = false): string {
  if (!hits.length) return es ? "Ninguna entrada está marcada por sí sola — rechazó el resultado; prueba otra foto de referencia u otras palabras." : "None of the inputs is flagged on its own — it rejected the result; try another reference photo or other wording.";
  const list = hits.map((h) => `${h.what}${h.categories.length ? ` (${h.categories.join(", ")})` : ""}`).join("; ");
  return es ? `Marcado: ${list}. Cámbialo o quítalo y vuelve a intentar.` : `Flagged: ${list}. Swap or remove it and try again.`;
}
