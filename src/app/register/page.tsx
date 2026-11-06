import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { discordAuthReady } from "@/lib/discord-auth";
import { getNumberSetting, getSettings } from "@/lib/settings";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const discordBonus = await getNumberSetting("discord_bonus").catch(() => 0);
  const discordServer = (await getSettings().catch(() => ({ discord_server: "" }))).discord_server || "";
  return <AuthForm mode="register" discord={discordAuthReady()} discordBonus={discordBonus} discordServer={discordServer} />;
}
