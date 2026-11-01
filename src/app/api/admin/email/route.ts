import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { emailReady, renderEmail, sendBatch, unsubUrl } from "@/lib/email";

export const maxDuration = 300;

const Schema = z.object({
  mode: z.enum(["test", "all"]),
  subject: z.string().trim().min(2).max(150),
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  imageUrl: z.string().max(600).nullish(),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaUrl: z.string().trim().max(400).default(""),
  audience: z.enum(["all", "buyers", "never_bought"]).default("all"),
});

/** Admin: how many users would get it. */
export const GET = handle(async () => {
  await apiAdmin();
  const [all, optedOut] = await Promise.all([db.user.count({ where: { banned: false } }), db.user.count({ where: { emailOptOut: true } })]);
  const hist = await db.setting.findUnique({ where: { key: "email_campaigns" } });
  return json({ ready: emailReady(), all, optedOut, history: hist ? JSON.parse(hist.value) : [] });
});

/** Admin: send a test to yourself, or the promo to every subscribed user. */
export const POST = handle(async (req: NextRequest) => {
  const admin = await apiAdmin();
  if (!emailReady()) throw new HttpError(400, "email_not_set_up");
  const c = Schema.parse(await req.json());
  const where = {
    banned: false,
    emailOptOut: false,
    ...(c.audience === "buyers" ? { payments: { some: {} } } : c.audience === "never_bought" ? { payments: { none: {} } } : {}),
  };
  const users = c.mode === "test" ? [admin] : await db.user.findMany({ where, select: { id: true, email: true, name: true, locale: true } });
  let sent = 0;
  for (let i = 0; i < users.length; i += 100) {
    const chunk = users.slice(i, i + 100).map((u) => {
      const unsub = unsubUrl(u.id);
      return { to: u.email, subject: c.subject, unsub, html: renderEmail(c, { name: u.name, unsub, es: u.locale !== "en", address: process.env.EMAIL_ADDRESS }) };
    });
    await sendBatch(chunk);
    sent += chunk.length;
  }
  if (c.mode === "all") {
    const hist = await db.setting.findUnique({ where: { key: "email_campaigns" } });
    const list = hist ? JSON.parse(hist.value) : [];
    list.unshift({ subject: c.subject, sent, audience: c.audience, at: new Date().toISOString() });
    const value = JSON.stringify(list.slice(0, 30));
    await db.setting.upsert({ where: { key: "email_campaigns" }, create: { key: "email_campaigns", value }, update: { value } });
  }
  return json({ sent });
});
