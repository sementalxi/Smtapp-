import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Current credit balance (polled by the header so admin changes show up live). */
export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ credits: null }, { status: 401 });
  const last = await db.creditTransaction.findFirst({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, type: true } });
  return NextResponse.json({ credits: me.credits, last }, { headers: { "Cache-Control": "no-store" } });
}
