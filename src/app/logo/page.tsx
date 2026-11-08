import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getNumberSetting } from "@/lib/settings";
import { LogoMaker } from "@/components/LogoMaker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Logo maker · KIXO" };

export default async function LogoPage({ searchParams }: { searchParams: Promise<{ set?: string }> }) {
  const user = await requireUser();
  const { locale } = await getT();
  const { set } = await searchParams;
  const staff = user.role === "ADMIN" || user.role === "STAFF";
  const cost = staff ? 0 : await getNumberSetting("logo_set_cost");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LogoMaker es={locale === "es"} cost={cost} credits={user.credits} initialSet={set ?? ""} />
    </div>
  );
}
