import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { changeCredits } from "@/lib/credits";

const Body = z.object({
  amount: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "amount cannot be 0"),
  note: z.string().trim().max(200).optional(),
});

export const POST = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await apiAdmin();
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (!(await db.user.findUnique({ where: { id } }))) throw new HttpError(404, "not_found");

  try {
    const tx = await changeCredits({
      userId: id,
      amount: body.amount,
      type: "ADMIN_ADJUST",
      note: body.note || (body.amount > 0 ? "Added by admin" : "Removed by admin"),
      adminId: admin.id,
    });
    return json({ balance: tx.balance });
  } catch (e) {
    if (e instanceof HttpError && e.status === 402) return json({ error: "Balance can't go below 0" }, 400);
    throw e;
  }
});
