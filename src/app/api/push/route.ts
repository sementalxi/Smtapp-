import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { vapidKeys } from "@/lib/push";

/** Public key the browser needs to subscribe. */
export const GET = handle(async () => {
  await apiUser();
  return json({ key: (await vapidKeys()).publicKey });
});

const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }) });

/** Save this device's subscription. */
export const POST = handle(async (req: NextRequest) => {
  const user = await apiUser();
  const s = Sub.parse(await req.json());
  await db.pushSub.upsert({
    where: { endpoint: s.endpoint },
    create: { userId: user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth },
    update: { userId: user.id, p256dh: s.keys.p256dh, auth: s.keys.auth },
  });
  return json({ ok: true });
});
