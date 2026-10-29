import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { appUrl, ensureCustomer, stripe } from "@/lib/stripe";

export const POST = handle(async () => {
  const user = await apiUser();
  const customer = await ensureCustomer(user);
  const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${appUrl()}/billing` });
  return json({ url: portal.url });
});
