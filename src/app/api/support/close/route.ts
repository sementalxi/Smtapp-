import { db } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { closeTicket } from "@/lib/support";

/** The user closes their ticket. */
export const POST = handle(async () => {
  const user = await apiUser();
  const t = await db.supportTicket.findFirst({ where: { userId: user.id, status: "open" } });
  if (t) await closeTicket(t, `${user.name} (website)`);
  return json({ ok: true });
});
