import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { BLOCKED } from "@/lib/ai";

export const maxDuration = 60;

// Fields the AI may rewrite, with their max length. Names, teams, scores, dates etc. are never touched.
const EDITABLE: Record<string, Record<string, number>> = {
  PLAYER: { tagline: 30, subtitle: 40, position: 24, footer: 48 },
  CHAMPIONS: { headline: 30, prize: 24, footer: 48 },
  MATCHDAY: { headline: 30, footer: 48 },
  LINEUP: { headline: 30, footer: 48 },
  RESULT: { headline: 30, footer: 48 },
  EVENT: { headline: 30, name: 40, subtitle: 40, details: 48, prize: 24, footer: 48 },
};

const Body = z.object({
  layout: z.enum(["PLAYER", "CHAMPIONS", "EVENT", "MATCHDAY", "LINEUP", "RESULT"]),
  language: z.string().max(20).default("English"),
  inputs: z.record(z.string(), z.string().max(200)),
});

const MODELS = [process.env.OPENAI_TEXT_MODEL?.trim(), "gpt-4.1-mini", "gpt-4o-mini"].filter(Boolean) as string[];

// Rewrites the poster's text so it sounds like a pro club social-media post. Free (no credits).
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "ai-text", 40, 60 * 60_000, user.id);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new HttpError(503, "ai_not_configured");
  const body = Body.parse(await req.json());
  const fields = EDITABLE[body.layout];
  const context: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.inputs as Record<string, string>)) if (v?.trim()) context[k] = v.slice(0, 200);
  if (JSON.stringify(context).match(BLOCKED)) throw new HttpError(400, "err_blocked");

  const system = [
    `You write the text for pro-clubs / esports / football social-media posters (player cards, match day, results, champions, tournaments).`,
    `Make the copy short, punchy and hype — like a top club's media team. ALL CAPS is fine for titles. Use the language: ${body.language}.`,
    `Rewrite or fill ONLY these fields, each within its max characters: ${Object.entries(fields).map(([k, n]) => `${k} (max ${n})`).join(", ")}.`,
    `Field meanings: tagline = a small elegant word above the player's name (e.g. "WELCOME", "THE CAPTAIN"); subtitle = a script-style accent line (e.g. "Born to score"); position = short position tag (e.g. "ST", "CAM | CM"); footer = a short letter-spaced line at the bottom (league, season, hashtag); headline = the huge main title; name = event title; details = times/entry info; prize = prize badge text.`,
    `Keep real facts the user gave (numbers, prizes, times, positions) — improve the wording, don't invent prices, dates or results. Never include player or team names in fields other than where the user already had them. No emojis.`,
    `Reply with JSON only: {"field": "text", ...} containing just those fields.`,
  ].join("\n");

  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Poster type: ${body.layout}\nCurrent text (JSON): ${JSON.stringify(context)}` },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (res.status === 404 || res.status === 400) {
      lastErr = `${model}: ${res.status}`;
      continue;
    }
    if (!res.ok) {
      lastErr = `${res.status}`;
      break;
    }
    const data = await res.json();
    let out: Record<string, unknown> = {};
    try {
      out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    } catch {
      /* ignore */
    }
    const result: Record<string, string> = {};
    for (const [k, max] of Object.entries(fields)) {
      const v = out[k];
      if (typeof v === "string" && v.trim() && !BLOCKED.test(v)) result[k] = v.trim().slice(0, max);
    }
    return json({ fields: result });
  }
  console.error("ai-text failed", lastErr);
  return json({ error: "ai_failed" }, 502);
});
