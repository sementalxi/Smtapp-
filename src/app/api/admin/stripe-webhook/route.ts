import { db } from "@/lib/db";
import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { appUrl, stripe, WEBHOOK_EVENTS } from "@/lib/stripe";

// One-click Stripe setup from the admin panel: registers this site's webhook
// endpoint in Stripe and saves its signing secret in the database.
export const POST = handle(async () => {
  await apiAdmin();
  if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(400, "Add STRIPE_SECRET_KEY first");

  const url = `${appUrl()}/api/stripe/webhook`;
  if (url.startsWith("http://localhost")) {
    throw new HttpError(400, "Run this on your live site (Stripe can't reach localhost). Locally, use `stripe listen`.");
  }

  // The secret is only shown when an endpoint is created, so replace any old one for this URL.
  const existing = await stripe().webhookEndpoints.list({ limit: 100 });
  for (const ep of existing.data) {
    if (ep.url === url) await stripe().webhookEndpoints.del(ep.id);
  }
  const ep = await stripe().webhookEndpoints.create({
    url,
    enabled_events: [...WEBHOOK_EVENTS],
    description: "Banner site credits",
  });
  if (!ep.secret) throw new HttpError(502, "Stripe did not return a signing secret");

  await db.setting.upsert({
    where: { key: "stripe_webhook_secret" },
    create: { key: "stripe_webhook_secret", value: ep.secret },
    update: { value: ep.secret },
  });
  return json({ ok: true, url });
});
