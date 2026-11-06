import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { normalizePhone, phoneOwner } from "@/lib/phone";

const Body = z.object({ phone: z.string().trim().max(30) });

/** A signed-in account that has no phone yet (Discord sign-ups) sets it ONCE; it can't be changed afterwards. */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  rateLimit(req, "phone", 10, 60 * 60_000);
  if (user.phone) return json({ error: "err_phone_locked" }, 400);
  const { phone: raw } = Body.parse(await req.json());
  const phone = normalizePhone(raw);
  if (!phone) return json({ error: "err_phone_invalid" }, 400);
  if (await phoneOwner(phone, user.id)) return json({ error: "err_phone_used" }, 409);
  await db.user.update({ where: { id: user.id }, data: { phone } });
  return json({ ok: true });
});
