import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const body = z
    .object({ name: z.string().trim().min(1).max(40).optional(), logoUrl: z.string().max(500).nullish(), sort: z.number().int().min(0).max(9999).optional() })
    .parse(await req.json());
  assertOwnUrl(body.logoUrl);
  await db.libraryItem.update({ where: { id }, data: body });
  return json({ ok: true });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  await db.libraryItem.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
});
