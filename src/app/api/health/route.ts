import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Quick status check: can the site reach its database? (no secrets in the output) */
export async function GET() {
  const out: Record<string, unknown> = { ok: true, blob: !!process.env.BLOB_READ_WRITE_TOKEN };
  try {
    const t = Date.now();
    await db.$queryRaw`SELECT 1`;
    out.dbMs = Date.now() - t;
    out.users = await db.user.count();
    const size = await db.$queryRaw<{ size: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
    out.dbSize = size[0]?.size;
    out.storedFiles = await db.storedFile.count();
  } catch (e) {
    out.ok = false;
    const msg = e instanceof Error ? e.message : String(e);
    out.error = msg.replace(/postgres(ql)?:\/\/\S+/g, "[db-url]").split("\n").filter(Boolean).slice(-3).join(" ").slice(0, 400);
    out.code = (e as { code?: string }).code;
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
