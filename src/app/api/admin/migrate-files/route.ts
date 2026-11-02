import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";

export const maxDuration = 120;

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4" };
const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Every text/JSON column in the app's tables (so no reference to an old file is missed). */
async function textColumns() {
  return db.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name <> 'StoredFile' AND table_name NOT LIKE '\\_prisma%'
      AND data_type IN ('text', 'character varying', 'json', 'jsonb')`;
}

/** GET: how many old images are still in the database. */
export const GET = handle(async () => {
  await apiAdmin();
  return json({ remaining: await db.storedFile.count(), blob: !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) });
});

/** POST: move the next batch of images from the database to Vercel Blob and update every link to them. */
export const POST = handle(async (_req: NextRequest) => {
  await apiAdmin();
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new HttpError(400, "blob_not_connected");
  const cols = await textColumns();
  const started = Date.now();
  let moved = 0;
  const failed: string[] = [];
  while (Date.now() - started < 90_000) {
    const files = await db.storedFile.findMany({ take: 5, orderBy: { createdAt: "asc" }, where: failed.length ? { id: { notIn: failed } } : undefined });
    if (!files.length) break;
    for (const f of files) {
      try {
        const oldUrl = `/api/files/db/${f.id}`;
        const ext = EXT[f.contentType] ?? "bin";
        const b = await put(`migrated/${f.createdAt.toISOString().slice(0, 7)}/${f.id}.${ext}`, Buffer.from(f.data), {
          access: "public",
          contentType: f.contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        // Point every saved link (posters, styles, deals, logos, settings…) to the new file.
        for (const c of cols) {
          const t = quote(c.table_name);
          const col = quote(c.column_name);
          if (c.data_type === "json" || c.data_type === "jsonb") {
            await db.$executeRawUnsafe(`UPDATE ${t} SET ${col} = replace(${col}::text, $1, $2)::${c.data_type} WHERE ${col}::text LIKE '%' || $1 || '%'`, oldUrl, b.url);
          } else {
            await db.$executeRawUnsafe(`UPDATE ${t} SET ${col} = replace(${col}, $1, $2) WHERE ${col} LIKE '%' || $1 || '%'`, oldUrl, b.url);
          }
        }
        await db.storedFile.delete({ where: { id: f.id } });
        moved++;
      } catch (e) {
        console.error("migrate file failed", f.id, e);
        failed.push(f.id);
      }
    }
  }
  return json({ moved, failed: failed.length, remaining: await db.storedFile.count() });
});
