import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";

/** Admin: bring a deleted style back (it comes back hidden — turn it on when ready). */
export const POST = handle(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await params;
  await db.template.update({ where: { id }, data: { deletedAt: null } });
  return json({ ok: true });
});
