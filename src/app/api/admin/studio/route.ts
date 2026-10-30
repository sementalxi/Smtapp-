import { NextRequest, after } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { generatePoster } from "@/lib/ai";
import { loadBytes, saveFile, sniffImage } from "@/lib/storage";
import { stampLogo } from "@/lib/stamp";
import { STUDIO_KINDS, STUDIO_SIZES, type StudioKind, type StudioSize } from "@/lib/studio";

export const maxDuration = 300;

const Schema = z.object({
  kind: z.enum(Object.keys(STUDIO_KINDS) as [keyof typeof STUDIO_KINDS]),
  size: z.enum(Object.keys(STUDIO_SIZES) as [keyof typeof STUDIO_SIZES]),
  quality: z.enum(["medium", "high"]).default("high"),
  prompt: z.string().trim().min(3).max(20000),
  texts: z.string().trim().max(2000).default(""),
  images: z.array(z.object({ url: z.string().min(1), role: z.string().trim().max(120).default("") })).max(6).default([]),
  stamp: z.boolean().default(false),
});

type Job = { status: "PENDING" | "READY" | "FAILED"; url?: string; error?: string; at: number; prompt?: string };
const key = (id: string) => `studio_job_${id}`;

/** Admin: start a free-form generation (runs in the background; poll GET ?id=). */
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const b = Schema.parse(await req.json());
  b.images.forEach((i) => assertOwnUrl(i.url));
  if (!process.env.OPENAI_API_KEY?.trim()) throw new HttpError(400, "OPENAI_API_KEY is not set");

  const id = randomUUID();
  const save = (j: Job) => db.setting.upsert({ where: { key: key(id) }, create: { key: key(id), value: JSON.stringify(j) }, update: { value: JSON.stringify(j) } });
  await save({ status: "PENDING", at: Date.now() });

  after(async () => {
    try {
      const refs: { bytes: Buffer; type: string }[] = [];
      const lines: string[] = [];
      for (const [n, im] of b.images.entries()) {
        const bytes = await loadBytes(im.url);
        const type = sniffImage(bytes) ?? "image/png";
        refs.push({ bytes, type });
        lines.push(`- Reference image ${n + 1}: ${im.role || "use it in the design"}`);
      }
      const prompt = [
        STUDIO_KINDS[b.kind as StudioKind].prompt,
        b.prompt,
        b.texts ? `TEXT ON THE DESIGN (spell exactly, nothing else):\n${b.texts}` : "",
        lines.length ? `REFERENCE IMAGES (in the order given):\n${lines.join("\n")}\nKeep people's faces and logos faithful to the references.` : "",
        `FINAL REMINDER — follow the admin's instructions above exactly: ${b.prompt.slice(0, 600)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      let out = await generatePoster(prompt, refs, b.quality, [...STUDIO_SIZES[b.size as StudioSize].sizes]);
      if (b.stamp) out = await stampLogo(out);
      const url = await saveFile("studio", out, "image/png");
      await save({ status: "READY", url, at: Date.now(), prompt });
      // keep a short history
      const hist = await db.setting.findUnique({ where: { key: "studio_recent" } });
      const list: { url: string; at: number; kind: string; size: string; by: string }[] = hist ? JSON.parse(hist.value) : [];
      list.unshift({ url, at: Date.now(), kind: b.kind, size: b.size, by: admin.email });
      const value = JSON.stringify(list.slice(0, 24));
      await db.setting.upsert({ where: { key: "studio_recent" }, create: { key: "studio_recent", value }, update: { value } });
    } catch (e) {
      await save({ status: "FAILED", error: String(e instanceof Error ? e.message : e).slice(0, 500), at: Date.now() }).catch(() => {});
    }
  });

  return json({ id });
});

/** Admin: job status. */
export const GET = handle(async (req: NextRequest) => {
  await apiAdmin();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "bad_id");
  const row = await db.setting.findUnique({ where: { key: key(id) } });
  if (!row) throw new HttpError(404, "not_found");
  const job = JSON.parse(row.value) as Job;
  if (job.status === "PENDING" && Date.now() - job.at > 330_000) return json({ status: "FAILED", error: "Timed out — try again" });
  return json(job);
});
