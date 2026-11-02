import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { assertOwnUrl } from "@/lib/banners";
import { parseRoster, mergeRoster, MAX_ROSTER } from "@/lib/roster";

const Player = z.object({ num: z.string().max(3), name: z.string().max(30), pos: z.string().max(4) });
const Body = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  logoUrl: z.string().max(500).nullish(),
  /** Replace the whole roster */
  players: z.array(Player).max(MAX_ROSTER).optional(),
  /** Add / update players (used after making a lineup or champions poster) */
  merge: z.array(Player).max(MAX_ROSTER).optional(),
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  const body = Body.parse(await req.json());
  const cur = await db.savedItem.findFirst({ where: { id, userId: user.id } });
  if (!cur) return json({ error: "not_found" }, 404);
  if (body.logoUrl !== undefined) assertOwnUrl(body.logoUrl);
  const clean = (a: z.infer<typeof Player>[]) => a.map((p) => ({ num: p.num.trim(), name: p.name.trim(), pos: p.pos.trim().toUpperCase() })).filter((p) => p.name);
  let players: string | undefined;
  if (body.players) players = JSON.stringify(clean(body.players));
  else if (body.merge) players = JSON.stringify(mergeRoster(parseRoster(cur.players), clean(body.merge)));
  const item = await db.savedItem.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl ?? null } : {}),
      ...(players !== undefined ? { players } : {}),
    },
    select: { id: true, name: true, logoUrl: true, players: true },
  });
  return json({ item: { ...item, players: parseRoster(item.players) } });
});

export const DELETE = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  await db.savedItem.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});
