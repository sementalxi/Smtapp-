import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { generateForBanner } from "@/lib/banners";
import { deleteFile } from "@/lib/storage";

export const maxDuration = 60;

const Body = z.object({ extraPrompt: z.string().trim().max(200).optional() });

// Paid: paints a brand-new AI background for an existing banner.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  rateLimit(req, "generate", 30, 60 * 60_000, user.id);
  const { id } = await params;
  const body = Body.parse(await req.json().catch(() => ({})));

  const banner = await db.banner.findUnique({ where: { id }, include: { template: true } });
  if (!banner || banner.userId !== user.id) throw new HttpError(404, "not_found");

  const old = banner.backgroundUrl;
  try {
    const updated = await generateForBanner({
      bannerId: banner.id,
      userId: user.id,
      cost: banner.template.cost,
      prompt: banner.template.prompt,
      extraPrompt: body.extraPrompt ?? "",
      backgroundOnly: true,
    });
    if (old && old !== updated.backgroundUrl) await deleteFile(old);
    return json({ backgroundUrl: updated.backgroundUrl });
  } catch (e) {
    if (e instanceof HttpError && e.status === 402) return json({ error: "err_credits" }, 402);
    if (e instanceof HttpError && e.message === "err_blocked") return json({ error: "err_blocked" }, 400);
    throw e;
  }
});
