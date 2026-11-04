// Admin Style test run: status, start / append, stop, advance.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { advanceStyleTest, getRun, startRun, stopRun } from "@/lib/style-test";
import { DEFAULT_SAMPLE } from "@/lib/style-test-inputs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Item = z.object({ id: z.string().min(1), name: z.string().max(80), layout: z.string().max(20), logoCreate: z.boolean() });
const SampleSchema = z.object({
  photoUrl: z.string().max(500),
  logoUrl: z.string().max(500),
  name: z.string().max(40),
  team: z.string().max(40),
  rival: z.string().max(40),
  position: z.string().max(10),
  number: z.string().max(4),
  tagline: z.string().max(40),
  subtitle: z.string().max(60),
  footer: z.string().max(60),
  competition: z.string().max(60),
  date: z.string().max(40),
  venue: z.string().max(40),
  mascot: z.string().max(80),
});
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), items: z.array(Item).min(1).max(300), sample: SampleSchema }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("advance") }),
]);

/** Results of the current run (and the admin's earlier test posters), newest first. */
async function results(userId: string) {
  const banners = await db.banner.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 400, include: { template: { select: { name: true, layout: true } } } });
  return banners
    .filter((b) => !!(b.design as unknown as { styleTest?: string } | null)?.styleTest)
    .map((b) => ({
      bannerId: b.id,
      templateId: b.templateId,
      templateName: b.template?.name ?? "",
      layout: b.template?.layout ?? "",
      status: b.status === "READY" ? "READY" : b.status === "FAILED" ? "FAILED" : "PROCESSING",
      finalUrl: b.finalUrl,
      error: b.error,
      madeWith: b.prompt?.match(/^\[Made with: ([^\]]+)\]/)?.[1] ?? null,
      seconds: b.status === "READY" || b.status === "FAILED" ? Math.max(1, Math.round((b.updatedAt.getTime() - b.createdAt.getTime()) / 1000)) : null,
      createdAt: b.createdAt.toISOString(),
      run: String((b.design as unknown as { styleTest?: string }).styleTest),
      stage: b.stage ?? null,
    }));
}

export const GET = handle(async () => {
  const admin = await apiAdmin();
  const run = await getRun();
  return json({ run, results: await results(admin.id) });
});

export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const body = Body.parse(await req.json());
  if (body.action === "start") {
    const sample = { ...DEFAULT_SAMPLE, ...body.sample };
    await db.setting.upsert({ where: { key: "style_test_sample" }, create: { key: "style_test_sample", value: JSON.stringify(sample) }, update: { value: JSON.stringify(sample) } });
    const run = await startRun(admin.id, body.items, sample);
    return json({ run, results: await results(admin.id) });
  }
  if (body.action === "stop") return json({ run: await stopRun(), results: await results(admin.id) });
  const did = await advanceStyleTest();
  return json({ did, run: await getRun(), results: await results(admin.id) });
});
