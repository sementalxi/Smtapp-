import { NextRequest } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { saveFile } from "@/lib/storage";
import { downloadImage } from "@/lib/image-search";

export const maxDuration = 30;

const Body = z.object({ url: z.string().url().max(2000), kind: z.enum(["photo", "logo"]).default("photo") });

// Copies an image the user picked from search into our own storage. Returns { url }.
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "upload", 60, 60 * 60_000, user.id);
  const body = Body.parse(await req.json());
  try {
    const { data, type } = await downloadImage(body.url);
    const url = await saveFile(body.kind === "logo" ? "logos" : "photos", data, type);
    return json({ url });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const known = ["bad_url", "file_too_large", "unsupported_type", "too_small"];
    return json({ error: known.includes(code) ? code : "fetch_failed" }, 400);
  }
});
