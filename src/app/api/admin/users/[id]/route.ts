import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";

const Body = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  banned: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await apiAdmin();
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (id === admin.id && (body.role === "USER" || body.banned)) {
    throw new HttpError(400, "You can't demote or suspend yourself");
  }
  const user = await db.user.update({ where: { id }, data: body }).catch(() => null);
  if (!user) throw new HttpError(404, "not_found");
  return json({ ok: true });
});
