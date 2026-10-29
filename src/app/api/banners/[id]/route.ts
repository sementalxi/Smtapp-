import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { DesignSchema, InputsSchema, titleFor, toJson } from "@/lib/banners";
import { deleteFile } from "@/lib/storage";
import { EMPTY_INPUTS } from "@/lib/templates";

type Ctx = { params: Promise<{ id: string }> };

async function ownBanner(id: string, userId: string, isAdmin: boolean) {
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner || (banner.userId !== userId && !isAdmin)) throw new HttpError(404, "not_found");
  return banner;
}

const Patch = z.object({
  design: DesignSchema.optional(),
  inputs: InputsSchema.optional(),
});

// Free edits: text and layout adjustments.
export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  const user = await apiUser();
  const { id } = await params;
  await ownBanner(id, user.id, false);
  const body = Patch.parse(await req.json());
  const inputs = body.inputs ? { ...EMPTY_INPUTS, ...body.inputs } : undefined;
  await db.banner.update({
    where: { id },
    data: {
      ...(body.design ? { design: toJson(body.design) } : {}),
      ...(inputs ? { inputs: toJson(inputs), title: titleFor(inputs) } : {}),
    },
  });
  return json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  const user = await apiUser();
  const { id } = await params;
  const b = await ownBanner(id, user.id, user.role === "ADMIN");
  await db.banner.delete({ where: { id } });
  // Photos/logos may be reused by other banners, so only remove generated files.
  await Promise.all([b.backgroundUrl, b.finalUrl, b.cutoutUrl !== b.photoUrl ? b.cutoutUrl : null].map(deleteFile));
  return json({ ok: true });
});
