import { getT } from "@/i18n/server";
import { ResetForm } from "@/components/ForgotForm";

export const metadata = { title: "New password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { locale } = await getT();
  const { t } = await searchParams;
  return <ResetForm es={locale === "es"} token={t ?? ""} />;
}
