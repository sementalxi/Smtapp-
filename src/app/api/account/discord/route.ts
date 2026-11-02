import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Unlink Discord from the logged-in account. */
export async function DELETE() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db.user.update({ where: { id: user.id }, data: { discordId: null, discordName: null } });
  return NextResponse.json({ ok: true });
}
