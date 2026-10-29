import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { CreateWizard } from "@/components/wizard/CreateWizard";
import { TeamSetForm } from "@/components/wizard/TeamSetForm";
import { db } from "@/lib/db";
import { seriesInfo } from "@/lib/banners";
import type { LayoutKind } from "@/lib/templates";

export const metadata = { title: "Create" };

const TYPES: LayoutKind[] = ["PLAYER", "CHAMPIONS", "MATCHDAY", "LINEUP", "RESULT", "EVENT"];

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ type?: string; match?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const templates = await activeTemplates();
  const { type, match } = await searchParams;

  // Team set: next card with the same design as one of the user's player cards.
  if (match) {
    const source = await db.banner.findFirst({
      where: { id: match, userId: user.id, mode: "PRO", status: "READY", template: { layout: "PLAYER" } },
    });
    if (source?.finalUrl) {
      const rootId = seriesInfo(source.design).seriesRootId ?? source.id;
      const mine = await db.banner.findMany({ where: { userId: user.id, mode: "PRO" }, select: { design: true }, take: 500 });
      const count = 1 + mine.filter((b) => seriesInfo(b.design).seriesRootId === rootId).length;
      const team = String((source.inputs as unknown as { team?: string } | null)?.team ?? "");
      return (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <TeamSetForm
            match={{ id: source.id, imageUrl: source.finalUrl, team, count }}
            credits={user.credits}
            cost={await getNumberSetting("pro_cost")}
          />
        </div>
      );
    }
  }
  const initial = TYPES.find((x) => x === type?.toUpperCase());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display mb-6 text-center text-4xl">{t("create_title")}</h1>
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
