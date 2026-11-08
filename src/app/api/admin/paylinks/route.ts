import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { newPayLinkId, payUrl } from "@/lib/paylinks";

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  amount: z.coerce.number().min(0.5).max(10000),
  customer: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});

export const POST = handle(async (req: NextRequest) => {
  const me = await apiAdmin();
  const b = Body.parse(await req.json());
  const link = await db.payLink.create({
    data: { id: newPayLinkId(), title: b.title, description: b.description, amountCents: Math.round(b.amount * 100), customer: b.customer, note: b.note, createdById: me.id },
  });
  return json({ link, url: payUrl(link.id) });
});
