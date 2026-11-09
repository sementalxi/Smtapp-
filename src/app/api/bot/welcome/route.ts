import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { botAuthorized } from "@/lib/bot-auth";
import { getSettings } from "@/lib/settings";

// AI welcome banners for the Discord bot: POST starts one (runs in the background), GET ?id= tells when it's ready.
export const dynamic = "force-dynamic";
export const maxDuration = 800; // the AI art + the member cut-out can take a few minutes

const j = (d: unknown, status = 200) => NextResponse.json(d, { status });
const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
const abs = (u: string) => (u.startsWith("/") ? site() + u : u);

const Body = z.object({
  discordId: z.string().regex(/^\d{15,22}$/),
  name: z.string().max(100).optional(),
  username: z.string().max(100).optional(),
  number: z.coerce.number().int().min(0).max(10_000_000).default(0),
  avatarUrl: z.string().max(600).optional(),
  test: z.boolean().optional(),
  /** /welcome-ai redo: always make a new banner (never hand back the one made earlier). */
  fresh: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!botAuthorized(req)) return j({ error: "unauthorized" }, 401);
  if (!process.env.OPENAI_API_KEY?.trim()) return j({ error: "OPENAI_API_KEY is not set" }, 400);
  const b = Body.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return j({ error: "bad_request" }, 400);
  const p = b.data;
  // Someone who left and joined again within a week gets the banner already made (no new AI cost).
  if (!p.test && !p.fresh) {
    const seen = await db.setting.findUnique({ where: { key: `welcome_ai_member:${p.discordId}` } });
    try {
      const prev = seen ? (JSON.parse(seen.value) as { url?: string; at?: number }) : null;
      if (prev?.url && prev.at && Date.now() - prev.at < 7 * 86_400_000) return j({ status: "READY", url: abs(prev.url), reused: true });
    } catch {
      /* make a new one */
    }
  }
  // Daily cap (Admin → Settings), so a wave of joins can't run up the AI bill. Tests count but are never refused.
  const cap = Number((await getSettings()).welcome_ai_daily ?? 25);
  const day = new Date().toISOString().slice(0, 10);
  const countKey = `welcome_ai_count:${day}`;
  const used = Number((await db.setting.findUnique({ where: { key: countKey } }))?.value ?? 0) || 0;
  if (!p.test && (cap <= 0 || used >= cap)) return j({ error: cap <= 0 ? "off" : "daily_limit", used, cap }, 429);
  await db.setting.upsert({ where: { key: countKey }, create: { key: countKey, value: String(used + 1) }, update: { value: String(used + 1) } });

  const { cleanWelcomeName, runWelcomeJob, saveWelcomeJob } = await import("@/lib/welcome-ai");
  const id = randomUUID();
  await saveWelcomeJob(id, { status: "PENDING", at: Date.now() });
  const name = cleanWelcomeName(p.name, p.username);
  after(() => runWelcomeJob(id, { discordId: p.discordId, name, number: p.number, avatarUrl: p.avatarUrl }));
  return j({ id, status: "PENDING" });
}

export async function GET(req: NextRequest) {
  if (!botAuthorized(req)) return j({ error: "unauthorized" }, 401);
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return j({ error: "bad_id" }, 400);
  const { readWelcomeJob } = await import("@/lib/welcome-ai");
  const job = await readWelcomeJob(id);
  if (!job) return j({ error: "not_found" }, 404);
  if (job.status === "PENDING" && Date.now() - job.at > 780_000) return j({ status: "FAILED", error: "timed out" });
  return j({ status: job.status, url: job.url ? abs(job.url) : undefined, error: job.error });
}
