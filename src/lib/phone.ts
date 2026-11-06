// One account per phone number. Players give their number when they register (no SMS check), it is stored in
// E.164 form, and only an admin can change it afterwards — a player with a used number is told to log in with
// that account or open a support ticket on Discord.
import { db } from "./db";

/** Accounts made from this moment on must have a phone (older accounts are not forced). */
export const PHONE_SINCE = new Date("2026-11-06T21:00:00Z");

/** "+1 (512) 555-0100" → "+15125550100"; null when it is not a plausible number. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim().replace(/[^\d+]/g, "");
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null; // 0000000000
  return `+${digits}`;
}

/** The account that already has this number (the caller decides what to tell the person). */
export async function phoneOwner(phone: string, exceptUserId?: string): Promise<{ id: string; email: string } | null> {
  const u = await db.user.findFirst({ where: { phone, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) }, select: { id: true, email: true } });
  return u ?? null;
}

/** True when this account still has to give its phone number (made after the rule, no phone yet). */
export function phoneMissing(user: { phone?: string | null; createdAt: Date; role?: string }): boolean {
  return !user.phone && user.createdAt >= PHONE_SINCE && user.role !== "ADMIN";
}
