import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { DealSchema } from "@/lib/deal-schema";

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const b = DealSchema.parse(await req.json());
  assertOwnUrl(b.imageUrl);
  const deal = await db.deal.create({ data: { ...b, imageUrl: b.imageUrl ?? null, endsAt: b.endsAt ? new Date(b.endsAt) : null } });
  return json({ deal });
});
