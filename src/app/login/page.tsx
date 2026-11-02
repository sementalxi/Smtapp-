import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { discordAuthReady } from "@/lib/discord-auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; err?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { next, err } = await searchParams;
  return <AuthForm mode="login" next={next} discord={discordAuthReady()} err={err} />;
}
