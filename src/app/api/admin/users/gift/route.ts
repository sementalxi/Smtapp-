import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { changeCredits } from "@/lib/credits";

export const maxDuration = 60;

// Admin: give every (non-banned) user the same number of credits.
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const { amount, note } = z
    .object({ amount: z.number().int().min(1).max(1000), note: z.string().trim().max(200).optional() })
    .parse(await req.json());
  const users = await db.user.findMany({ where: { banned: false }, select: { id: true } });
  let done = 0;
  for (const u of users) {
    await changeCredits({ userId: u.id, amount, type: "ADMIN_ADJUST", note: note || "Gift for everyone", adminId: admin.id });
    done++;
  }
  return json({ users: done });
});
