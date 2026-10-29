import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { deleteFile, saveFile, sniffImage } from "@/lib/storage";

// Stores the exported PNG so it shows in the gallery and the admin panel.
export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await params;
  const banner = await db.banner.findUnique({ where: { id } });
  if (!banner || banner.userId !== user.id) throw new HttpError(404, "not_found");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size > 15 * 1024 * 1024) throw new HttpError(400, "bad_file");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) throw new HttpError(415, "unsupported_type");

  const url = await saveFile("banners", buf, type);
  await db.banner.update({ where: { id }, data: { finalUrl: url } });
  await deleteFile(banner.finalUrl);
  return json({ url });
});
