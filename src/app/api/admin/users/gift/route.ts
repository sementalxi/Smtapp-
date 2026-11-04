import { NextRequest, after } from "next/server";
import { dmCreditChange } from "@/lib/credit-dm";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { changeCredits } from "@/lib/credits";

export const maxDuration = 300;

// Admin: give every (non-banned) user the same number of credits.
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  const { amount, note } = z
    .object({ amount: z.number().int().min(1).max(1000), note: z.string().trim().max(200).optional() })
    .parse(await req.json());
  const users = await db.user.findMany({ where: { banned: false }, select: { id: true } });
  let done = 0;
  const balances: { id: string; balance: number }[] = [];
  for (const u of users) {
    const tx = await changeCredits({ userId: u.id, amount, type: "ADMIN_ADJUST", note: note || "Gift for everyone", adminId: admin.id });
    balances.push({ id: u.id, balance: tx.balance });
    done++;
  }
  // Discord DMs go out in the background (a few per second, so Discord doesn't rate-limit us).
  after(async () => {
    for (const b of balances) {
      await dmCreditChange(b.id, amount, b.balance, note || undefined);
      await new Promise((r) => setTimeout(r, 400));
    }
  });
  return json({ users: done });
});
