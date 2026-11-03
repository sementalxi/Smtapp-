// Web push (phone notifications). VAPID keys are made once and kept in the database — nothing to set up.
import { db } from "./db";

type WebPush = typeof import("web-push");
let wp: WebPush | null = null;
let keys: { publicKey: string; privateKey: string } | null = null;

async function lib(): Promise<WebPush> {
  wp ??= ((await import("web-push")) as unknown as { default?: WebPush }).default ?? ((await import("web-push")) as unknown as WebPush);
  return wp;
}

export async function vapidKeys() {
  if (keys) return keys;
  const w = await lib();
  const row = await db.setting.findUnique({ where: { key: "vapid_keys" } });
  if (row) keys = JSON.parse(row.value);
  else {
    const k = w.generateVAPIDKeys();
    // If two requests race, the first saved pair wins.
    await db.setting.create({ data: { key: "vapid_keys", value: JSON.stringify(k) } }).catch(() => {});
    const again = await db.setting.findUnique({ where: { key: "vapid_keys" } });
    keys = again ? JSON.parse(again.value) : k;
  }
  return keys!;
}

/** Sends a notification to every device this user turned notifications on for. Removes dead subscriptions. */
export async function pushToUser(userId: string, msg: { title: string; body: string; url?: string; tag?: string }) {
  const subs = await db.pushSub.findMany({ where: { userId } });
  if (!subs.length) return 0;
  const w = await lib();
  const k = await vapidKeys();
  const site = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
  w.setVapidDetails(site, k.publicKey, k.privateKey);
  let sent = 0;
  for (const s of subs) {
    try {
      await w.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.pushSub.delete({ where: { id: s.id } }).catch(() => {});
    }
  }
  return sent;
}
