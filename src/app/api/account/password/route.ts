import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";

/** Change password (needs the current one). */
export const POST = handle(async (req: NextRequest) => {
  rateLimit(req, "password", 10, 60 * 60_000);
  const user = await apiUser();
  const b = z.object({ current: z.string().min(1).max(200), next: z.string().min(8).max(200) }).parse(await req.json());
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(b.current, full.passwordHash))) throw new HttpError(400, "wrong_password");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(b.next, 11) } });
  return json({ ok: true });
});
