import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { put, del } from "@vercel/blob";
import { db } from "./db";

const LOCAL_DIR = path.join(process.cwd(), "uploads");

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

let s3: S3Client | null = null;
function client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return s3;
}

// Order: S3 if configured → Vercel Blob if connected → local folder in development →
// the database otherwise (always works on Vercel, nothing to set up).
const driver = () =>
  process.env.STORAGE_DRIVER === "s3"
    ? "s3"
    : process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID
      ? "blob"
      : process.env.NODE_ENV === "production"
        ? "db"
        : "local";

const DB_PREFIX = "/api/files/db/";

async function saveToDb(data: Buffer, contentType: string) {
  const row = await db.storedFile.create({ data: { contentType, data: new Uint8Array(data) } });
  return `${DB_PREFIX}${row.id}`;
}

export async function readDbFile(id: string) {
  const row = await db.storedFile.findUnique({ where: { id } });
  if (!row) return null;
  return { contentType: row.contentType, data: Buffer.from(row.data) };
}

/** Public hosts our stored files can live on (used to block arbitrary URLs). */
export function isStorageUrl(url: string) {
  if (url.startsWith("/api/files/")) return true;
  const s3 = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (s3 && url.startsWith(s3 + "/")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Saves bytes and returns a public URL. `folder` is e.g. "photos" or "banners". */
export async function saveFile(folder: string, data: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType] ?? "bin";
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;

  if (driver() === "db") return saveToDb(data, contentType);

  if (driver() === "blob") {
    try {
      const res = await put(key, data, { access: "public", contentType, addRandomSuffix: false });
      return res.url;
    } catch (e) {
      // e.g. a private Blob store, or a token problem — don't break uploads.
      console.error("Vercel Blob upload failed, saving to the database instead", e);
      return saveToDb(data, contentType);
    }
  }

  if (driver() === "s3") {
    await client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
    return `${base}/${key}`;
  }

  const full = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return `/api/files/${key}`;
}

export async function deleteFile(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(DB_PREFIX)) {
      await db.storedFile.delete({ where: { id: url.slice(DB_PREFIX.length) } });
    } else if (url.startsWith("/api/files/")) {
      const key = url.slice("/api/files/".length);
      await fs.unlink(path.join(LOCAL_DIR, safeKey(key)));
    } else if (url.includes(".public.blob.vercel-storage.com/")) {
      await del(url);
    } else if (driver() === "s3") {
      const base = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");
      if (base && url.startsWith(base + "/")) {
        await client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: url.slice(base.length + 1) }));
      }
    }
  } catch (e) {
    console.warn("deleteFile failed", url, e);
  }
}

/** Prevents path traversal for the local driver. */
export function safeKey(key: string) {
  const norm = path.posix.normalize(key).replace(/^(\.\.(\/|$))+/, "");
  if (norm.includes("..") || path.isAbsolute(norm)) throw new Error("bad key");
  return norm;
}

export async function readLocalFile(key: string) {
  return fs.readFile(path.join(LOCAL_DIR, safeKey(key)));
}

/** Reads an uploaded image back as bytes (works for both drivers). */
export async function loadBytes(url: string): Promise<Buffer> {
  if (url.startsWith(DB_PREFIX)) {
    const f = await readDbFile(url.slice(DB_PREFIX.length));
    if (!f) throw new Error("file not found");
    return f.data;
  }
  if (url.startsWith("/api/files/")) return readLocalFile(url.slice("/api/files/".length));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Detects image type from magic bytes — never trust the browser's mime type. */
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
