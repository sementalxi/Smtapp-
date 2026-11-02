import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { discordAuthReady } from "@/lib/discord-auth";
import { getNumberSetting } from "@/lib/settings";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const discordBonus = await getNumberSetting("discord_bonus").catch(() => 0);
  return <AuthForm mode="register" discord={discordAuthReady()} discordBonus={discordBonus} />;
}
