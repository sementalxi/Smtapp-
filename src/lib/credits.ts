import { Prisma, TxType } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./auth";

type Tx = Prisma.TransactionClient;

interface ChangeOpts {
  userId: string;
  amount: number; // positive = add, negative = remove
  type: TxType;
  note?: string;
  adminId?: string;
  bannerId?: string;
  externalRef?: string;
  /** When true a removal may push the balance below zero is NOT allowed (default). */
  allowNegative?: boolean;
}

async function applyChange(tx: Tx, o: ChangeOpts) {
  if (!Number.isInteger(o.amount) || o.amount === 0) throw new HttpError(400, "invalid_amount");

  let balance: number;
  if (o.amount < 0 && !o.allowNegative) {
    // Atomic conditional decrement: only succeeds when enough credits exist.
    const res = await tx.user.updateMany({
      where: { id: o.userId, credits: { gte: -o.amount } },
      data: { credits: { increment: o.amount } },
    });
    if (res.count === 0) throw new HttpError(402, "not_enough_credits");
    balance = (await tx.user.findUniqueOrThrow({ where: { id: o.userId }, select: { credits: true } })).credits;
  } else {
    const u = await tx.user.update({
      where: { id: o.userId },
      data: { credits: { increment: o.amount } },
      select: { credits: true },
    });
    balance = u.credits;
  }

  return tx.creditTransaction.create({
    data: {
      userId: o.userId,
      amount: o.amount,
      balance,
      type: o.type,
      note: o.note,
      adminId: o.adminId,
      bannerId: o.bannerId,
      externalRef: o.externalRef,
    },
  });
}

/** Add or remove credits and write a ledger entry, in one DB transaction. */
export async function changeCredits(o: ChangeOpts, tx?: Tx) {
  if (tx) return applyChange(tx, o);
  return db.$transaction((t) => applyChange(t, o));
}

/**
 * Grant credits exactly once for a given external reference (Stripe event / session).
 * Returns false when it was already granted.
 */
export async function grantOnce(o: ChangeOpts & { externalRef: string }) {
  const exists = await db.creditTransaction.findUnique({ where: { externalRef: o.externalRef } });
  if (exists) return false;
  try {
    await changeCredits(o);
    return true;
  } catch (e) {
    // Unique constraint race: another webhook delivery got there first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
