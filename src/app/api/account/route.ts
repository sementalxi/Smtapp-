import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";
import { gamertagSchema, platformSchema } from "@/lib/gamertag";
import { storeGamerpic } from "@/lib/xbox";

/** Update profile (name, showcase sharing). */
export const PATCH = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const b = z
    .object({ name: z.string().trim().min(1).max(60).optional(), showcaseOptOut: z.boolean().optional(), gamertag: gamertagSchema.optional(), gamePlatform: platformSchema.optional().or(z.literal("")), xboxXuid: z.string().regex(/^\d{6,20}$/).optional(), gamerPic: z.string().max(600).optional() })
    .parse(await req.json());
  await db.user.update({
    where: { id: user.id },
    data: {
      ...(b.name ? { name: b.name } : {}),
      ...(b.showcaseOptOut !== undefined ? { showcaseOptOut: b.showcaseOptOut } : {}),
      ...(b.gamertag !== undefined ? { gamertag: b.gamertag || null } : {}),
      ...(b.gamePlatform !== undefined ? { gamePlatform: b.gamePlatform || null } : {}),
      // picked from the Xbox search: keep the account id and gamerpic; any other change clears them
      ...(b.xboxXuid ? { xboxXuid: b.xboxXuid, gamerPic: b.gamerPic ? (await storeGamerpic(b.gamerPic)) || null : null } : b.gamertag !== undefined && (b.gamertag || null) !== (await db.user.findUnique({ where: { id: user.id }, select: { gamertag: true } }))?.gamertag ? { xboxXuid: null, gamerPic: null } : {}),
    },
  });
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
