// Daily reward: GET = today's status for the signed-in user, POST = claim it (once per day).
import { apiUser } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { claimDaily, dailyStatus } from "@/lib/daily";
import { getLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await apiUser();
  const locale = await getLocale();
  return json(await dailyStatus(user.id, locale));
});

export const POST = handle(async () => {
  const user = await apiUser();
  const result = await claimDaily(user.id);
  return json({ ok: true, ...result });
});
