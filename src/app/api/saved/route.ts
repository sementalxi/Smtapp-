import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";

const Kind = z.enum(["team", "championship"]);

// The user's saved teams / championships (name + logo), reused across banners.
export const GET = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const kind = Kind.parse(req.nextUrl.searchParams.get("kind"));
  const items = await db.savedItem.findMany({
    where: { userId: user.id, kind },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, logoUrl: true },
  });
  return json({ items });
});

const Body = z.object({
  kind: Kind,
  name: z.string().trim().min(1).max(40),
  logoUrl: z.string().max(500).nullish(),
});

export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const body = Body.parse(await req.json());
  assertOwnUrl(body.logoUrl);
  const count = await db.savedItem.count({ where: { userId: user.id } });
  if (count >= 200) return json({ error: "Too many saved items" }, 400);
  const item = await db.savedItem.create({
    data: { userId: user.id, kind: body.kind, name: body.name, logoUrl: body.logoUrl ?? null },
    select: { id: true, name: true, logoUrl: true },
  });
  return json({ item });
});
