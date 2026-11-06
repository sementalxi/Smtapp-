import { NextRequest } from "next/server";
import { z } from "zod";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { detectSlotsFromImage } from "@/lib/detect-slots";

export const maxDuration = 60;

const Body = z.object({ styleRefUrl: z.string().min(1).max(500) });

/** Admin (style editor): list a flyer's text lines as boxes without saving anything. */
export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const { styleRefUrl } = Body.parse(await req.json());
  return json({ slots: await detectSlotsFromImage(styleRefUrl) });
});
