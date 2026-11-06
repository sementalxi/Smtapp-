import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";

const Body = z.object({
  role: z.enum(["USER", "ADMIN", "STAFF", "SUPPORT"]).optional(),
  banned: z.boolean().optional(),
  isOrg: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  /** The phone number (one account per number) — only an admin changes it; "" clears it. */
  phone: z.string().trim().max(30).optional(),
});

export const PATCH = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await apiAdmin();
  const { id } = await params;
  const body = Body.parse(await req.json());
  if (id === admin.id && (body.role === "USER" || body.banned)) {
    throw new HttpError(400, "You can't demote or suspend yourself");
  }
  const data: Record<string, unknown> = { ...body };
  if (body.phone !== undefined) {
    if (admin.role !== "ADMIN") throw new HttpError(403, "forbidden");
    const { normalizePhone, phoneOwner } = await import("@/lib/phone");
    const phone = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !phone) throw new HttpError(400, "That phone number isn't valid");
    if (phone) {
      const owner = await phoneOwner(phone, id);
      if (owner) throw new HttpError(409, `That number already belongs to ${owner.email}`);
    }
    data.phone = phone;
  }
  const user = await db.user.update({ where: { id }, data }).catch(() => null);
  if (!user) throw new HttpError(404, "not_found");
  return json({ ok: true });
});

/** Permanently delete an account and everything that belongs to it. Cancels a paid Square subscription first. */
export const DELETE = handle(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await apiAdmin();
  const { id } = await params;
  if (id === admin.id) throw new HttpError(400, "You can't delete your own account");
  const u = await db.user.findUnique({ where: { id }, select: { id: true, email: true, subscriptionId: true, subscriptionStatus: true } });
  if (!u) throw new HttpError(404, "not_found");
  const confirm = (await req.json().catch(() => ({}))) as { email?: string };
  if ((confirm.email ?? "").trim().toLowerCase() !== u.email.toLowerCase()) throw new HttpError(400, "confirm_email");
  // Stop future charges.
  if (u.subscriptionId && u.subscriptionStatus !== "comp" && u.subscriptionStatus !== "canceled") {
    const { sq } = await import("@/lib/square");
    await sq(`/subscriptions/${u.subscriptionId}/cancel`, { method: "POST" }).catch(() => {});
  }
  // Things without an automatic cascade.
  await Promise.all([
    db.savedItem.deleteMany({ where: { userId: id } }),
    db.squareCheckout.deleteMany({ where: { userId: id } }).catch(() => {}),
    db.supportTicket.deleteMany({ where: { userId: id } }),
    db.pushSub.deleteMany({ where: { userId: id } }),
    db.videoJob.deleteMany({ where: { userId: id } }),
    db.user.updateMany({ where: { referredById: id }, data: { referredById: null } }),
  ]);
  await db.user.delete({ where: { id } }); // posters, payments and credit history cascade
  await import("@/lib/activity").then((m) => m.logActivity("site", "account_deleted", `🗑️ Account deleted by ${admin.email}: ${u.email}`, "warn")).catch(() => {});
  return json({ ok: true });
});
