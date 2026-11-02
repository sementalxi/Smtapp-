import { getT } from "@/i18n/server";
import { ForgotForm } from "@/components/ForgotForm";

export const metadata = { title: "Forgot password" };

export default async function ForgotPage() {
  const { locale } = await getT();
  return <ForgotForm es={locale === "es"} />;
}
