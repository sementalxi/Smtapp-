import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";

const Body = z.object({
  kind: z.enum(["championship", "team", "partner"]),
  name: z.string().trim().min(1).max(40),
  logoUrl: z.string().max(500).nullish(),
});

// Admin: add an official league / competition / team logo everyone can pick.
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const body = Body.parse(await req.json());
  assertOwnUrl(body.logoUrl);
  const item = await db.libraryItem.create({ data: { kind: body.kind, name: body.name, logoUrl: body.logoUrl ?? null } });
  return json({ item });
});
