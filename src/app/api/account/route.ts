import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

/** Update profile (name). */
export const PATCH = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const b = z.object({ name: z.string().trim().min(1).max(60) }).parse(await req.json());
  await db.user.update({ where: { id: user.id }, data: { name: b.name } });
  return json({ ok: true });
});

/** Delete own account (needs the password). Admin accounts can't be deleted here. */
export const DELETE = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const b = z.object({ password: z.string().min(1).max(200) }).parse(await req.json());
  if (user.role === "ADMIN") throw new HttpError(400, "admin_cannot_delete");
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(b.password, full.passwordHash))) throw new HttpError(400, "wrong_password");
  await db.savedItem.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await db.squareCheckout.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await db.user.updateMany({ where: { referredById: user.id }, data: { referredById: null } });
  await db.user.delete({ where: { id: user.id } });
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
