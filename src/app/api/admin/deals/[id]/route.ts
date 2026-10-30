import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { DealSchema } from "@/lib/deal-schema";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  const b = DealSchema.partial().parse(await req.json());
  assertOwnUrl(b.imageUrl);
  const { endsAt, ...rest } = b;
  const deal = await db.deal.update({
    where: { id },
    data: { ...rest, ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}) },
  });
  return json({ deal });
});

export const DELETE = handle(async (_req: NextRequest, { params }: Ctx) => {
  await apiAdmin();
  const { id } = await params;
  await db.deal.delete({ where: { id } }).catch(() => null);
  return json({ ok: true });
});
