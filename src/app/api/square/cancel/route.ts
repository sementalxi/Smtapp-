import { db } from "@/lib/db";
import { apiUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { sq } from "@/lib/square";

// Cancels the user's Square subscription at the end of the paid month.
export const POST = handle(async () => {
  const user = await apiUser();
  if (!user.subscriptionId) throw new HttpError(400, "no_subscription");
  await sq(`/subscriptions/${user.subscriptionId}/cancel`, { method: "POST" });
  await db.user.update({ where: { id: user.id }, data: { subscriptionStatus: "canceling" } });
  return json({ ok: true });
});
