import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export const DELETE = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  await db.savedItem.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});
