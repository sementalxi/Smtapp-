import { NextRequest } from "next/server";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { saveFile, sniffImage } from "@/lib/storage";
import { getNumberSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/ratelimit";

// Uploads a photo or logo. Returns { url }.
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "upload", 60, 60 * 60_000, user.id);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) throw new HttpError(400, "no_file");

  const maxMb = await getNumberSetting("max_upload_mb");
  if (file.size > maxMb * 1024 * 1024) throw new HttpError(413, "file_too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) throw new HttpError(415, "unsupported_type");

  const kind = form.get("kind") === "logo" ? "logos" : "photos";
  try {
    const url = await saveFile(kind, buf, type);
    return json({ url });
  } catch (e) {
    console.error("upload failed", e);
    return json({ error: `Upload failed: ${e instanceof Error ? e.message.slice(0, 160) : "unknown"}` }, 500);
  }
});
