import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { refreshPayLink } from "@/lib/paylinks";

const Body = z.object({ action: z.enum(["cancel", "reopen", "paid", "check"]) });

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await ctx.params;
  const { action } = Body.parse(await req.json());
  const link = await db.payLink.findUniqueOrThrow({ where: { id } });
  if (action === "check") await refreshPayLink(link);
  else if (action === "cancel" && link.status === "open") await db.payLink.update({ where: { id }, data: { status: "canceled" } });
  else if (action === "reopen" && link.status === "canceled") await db.payLink.update({ where: { id }, data: { status: "open" } });
  else if (action === "paid" && link.status !== "paid") await db.payLink.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paidRef: "manual" } });
  return json({ link: await db.payLink.findUnique({ where: { id } }) });
});

export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await apiAdmin();
  const { id } = await ctx.params;
  await db.payLink.delete({ where: { id } });
  return json({ ok: true });
});
