import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { phoneVerifyReady } from "@/lib/twilio";
import { discordAuthReady } from "@/lib/discord-auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="register" phoneRequired={phoneVerifyReady()} discord={discordAuthReady()} />;
}
