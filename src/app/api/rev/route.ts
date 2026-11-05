import { NextResponse } from "next/server";
import { getRev } from "@/lib/rev";

export const dynamic = "force-dynamic";

/** Tiny endpoint the pages poll to know when something changed. */
export async function GET() {
  const rev = await getRev().catch(() => "0");
  return NextResponse.json({ rev }, { headers: { "cache-control": "no-store" } });
}
