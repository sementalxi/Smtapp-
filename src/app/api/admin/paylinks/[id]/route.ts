import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { cleanPayer, markPayLinkPaid, paymentsOfLinks, refreshPayLink } from "@/lib/paylinks";

const Body = z.object({
  // cancel / reopen: close or reopen the link · paid: mark a one-payment link paid by hand · check: ask the provider
  // multi / single: switch between "open for everyone" and "one payment"
  // add: add a payment by hand to an open link (payer) · remove: take one payment off its list (paymentId)
  action: z.enum(["cancel", "reopen", "paid", "check", "multi", "single", "add", "remove"]),
  payer: z.string().max(200).optional(),
  paymentId: z.string().max(60).optional(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await ctx.params;
  const { action, payer, paymentId } = Body.parse(await req.json());
  const link = await db.payLink.findUniqueOrThrow({ where: { id } });
  if (action === "check") await refreshPayLink(link);
  else if (action === "cancel" && link.status === "open") await db.payLink.update({ where: { id }, data: { status: "canceled" } });
  else if (action === "reopen" && link.status === "canceled") await db.payLink.update({ where: { id }, data: { status: "open" } });
  else if (action === "paid" && !link.multi && link.status !== "paid") await db.payLink.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paidRef: "manual" } });
  else if (action === "multi" && !link.multi) {
    // One payment → open for everyone. A payment it already got becomes the first one of its list.
    if (link.status === "paid") {
      const ref = link.paidRef && link.paidRef !== "manual" ? link.paidRef : `manual_${crypto.randomUUID()}`;
      await db.payLinkPayment
        .create({ data: { linkId: id, ref, status: "paid", paidAt: link.paidAt ?? new Date(), createdAt: link.paidAt ?? new Date(), amountCents: link.amountCents, payer: cleanPayer(link.customer), provider: link.paidRef === "manual" ? "manual" : link.provider } })
        .catch((e: unknown) => {
          if ((e as { code?: string } | null)?.code !== "P2002") throw e; // P2002: it is already on the list
        });
    }
    await db.payLink.update({ where: { id }, data: { multi: true, status: link.status === "canceled" ? "canceled" : "open" } });
  } else if (action === "single" && link.multi) {
    // Open for everyone → one payment: paid if it already has a payment, otherwise still waiting.
    const last = await db.payLinkPayment.findFirst({ where: { linkId: id, status: "paid" }, orderBy: { createdAt: "desc" } });
    await db.payLink.update({ where: { id }, data: { multi: false, ...(link.status === "open" && last ? { status: "paid", paidAt: last.paidAt ?? last.createdAt, paidRef: last.ref } : {}) } });
  } else if (action === "add" && link.multi) {
    // They paid another way (cash, transfer…): listed by hand under the given name.
    await markPayLinkPaid(id, `manual_${crypto.randomUUID()}`, link.amountCents, { payer: cleanPayer(payer), provider: "manual" });
  } else if (action === "remove" && paymentId) {
    // Kept as "removed" (not deleted), so a late provider notice about the same payment never lists it again.
    await db.payLinkPayment.updateMany({ where: { id: paymentId, linkId: id }, data: { status: "removed" } });
  }
  return json({ link: await db.payLink.findUnique({ where: { id } }), payments: (await paymentsOfLinks([id]))[id] ?? [] });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await ctx.params;
  await db.payLinkPayment.deleteMany({ where: { linkId: id } });
  await db.payLink.delete({ where: { id } });
  return json({ ok: true });
});
