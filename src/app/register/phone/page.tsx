import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { phoneMissing } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { PhoneStep } from "@/components/PhoneStep";

/** The one-time phone step for accounts that signed up without one (Discord): one account per number. */
export default async function PhonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { next } = await searchParams;
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/create";
  if (user.phone || !phoneMissing(user)) redirect(dest);
  const discordServer = (await getSettings().catch(() => ({ discord_server: "" }))).discord_server || "";
  return <PhoneStep next={dest} discordServer={discordServer} />;
}
