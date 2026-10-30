import { randomBytes } from "crypto";
import { db } from "./db";
import { grantOnce } from "./credits";
import { getNumberSetting } from "./settings";

export const REF_COOKIE = "kixo_ref";

/** The user's personal invite code (created the first time it's needed). */
export async function ensureRefCode(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { refCode: true } });
  if (u?.refCode) return u.refCode;
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(5).toString("base64url").replace(/[-_]/g, "").slice(0, 7).toUpperCase();
    if (code.length < 6) continue;
    try {
      await db.user.update({ where: { id: userId }, data: { refCode: code } });
      return code;
    } catch {
      /* clash — try again */
    }
  }
  throw new Error("could not create invite code");
}

/** Called after any successful payment: rewards whoever invited this user — once per invited user. */
export async function rewardReferrer(userId: string) {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { referredById: true, name: true } });
    if (!u?.referredById || u.referredById === userId) return;
    const amount = await getNumberSetting("referral_reward");
    if (amount <= 0) return;
    await grantOnce({ userId: u.referredById, amount, type: "REFERRAL", note: `Invite reward: ${u.name}`.slice(0, 120), externalRef: `ref_${userId}` });
  } catch (e) {
    console.error("referral reward failed", e);
  }
}
