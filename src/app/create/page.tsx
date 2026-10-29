import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { CreateWizard } from "@/components/wizard/CreateWizard";
import type { LayoutKind } from "@/lib/templates";

export const metadata = { title: "Create" };

const TYPES: LayoutKind[] = ["PLAYER", "CHAMPIONS", "MATCHDAY", "LINEUP", "RESULT", "EVENT"];

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const templates = await activeTemplates();
  const { type } = await searchParams;
  const initial = TYPES.find((x) => x === type?.toUpperCase());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display chrome mb-6 text-center text-4xl">{t("create_title")}</h1>
      <CreateWizard
        templates={templates}
        credits={user.credits}
        cost={await getNumberSetting("pro_cost")}
        proEnabled={proConfigured()}
        initialLayout={initial}
      />
    </div>
  );
}
