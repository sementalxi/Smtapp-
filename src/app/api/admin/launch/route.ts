import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { botReady, giveLinkRole, listRoles } from "@/lib/discord-bot";

export const maxDuration = 60;

/** Coming-soon mode + the Discord role for linked accounts. */
export const GET = handle(async () => {
  await apiAdmin();
  const st = await getSettings();
  const linked = await db.user.count({ where: { discordId: { not: null } } });
  return json({ comingSoon: st.coming_soon === "1", role: st.discord_link_role || "", roles: await listRoles(), bot: botReady(), linked });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), comingSoon: z.boolean(), role: z.string().regex(/^(\d{15,22})?$/) }),
  z.object({ action: z.literal("giveAll") }),
]);

export const POST = handle(async (req: NextRequest) => {
  await apiAdmin();
  const b = Body.parse(await req.json());
  if (b.action === "save") {
    for (const [key, value] of [["coming_soon", b.comingSoon ? "1" : "0"], ["discord_link_role", b.role]] as const) {
      await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    return json({ ok: true });
  }
  // Give the role to everyone who already linked Discord.
  const users = await db.user.findMany({ where: { discordId: { not: null } }, select: { discordId: true }, take: 2000 });
  let ok = 0, notIn = 0, err = "";
  for (const u of users) {
    const r = await giveLinkRole(u.discordId!);
    if (r.ok) ok++;
    else if (r.error === "not_in_server") notIn++;
    else { err = r.error ?? "error"; if (err === "no_permission" || err === "no_role" || err === "missing") break; }
    await new Promise((res) => setTimeout(res, 250)); // stay under Discord's rate limit
  }
  return json({ ok: !err || ok > 0, given: ok, notInServer: notIn, error: err || undefined });
});
