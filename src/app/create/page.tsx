import Link from "next/link";
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
import { visibleCategories } from "@/lib/categories";

export const metadata = { title: "Create" };

const TYPES: LayoutKind[] = ["PLAYER", "CHAMPIONS", "MATCHDAY", "LINEUP", "RESULT", "EVENT"];

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ type?: string; match?: string; team?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const templates = await activeTemplates();
  const { type, match, team: teamMode } = await searchParams;

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
  // Team cards: pick which design the squad's cards should share.
  if (teamMode) {
    const { locale } = await getT();
    const es = locale === "es";
    const cards = await db.banner.findMany({
      where: { userId: user.id, mode: "PRO", status: "READY", finalUrl: { not: null }, template: { layout: "PLAYER" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, finalUrl: true, title: true },
    });
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-center text-4xl">👥 {es ? "Tarjetas del equipo" : "Team player cards"}</h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted">
          {es
            ? "Elige el diseño que tendrá todo el equipo. Luego solo agregas la foto, nombre y número de cada jugador."
            : "Pick the design the whole team will share. Then just add each player's photo, name and number."}
        </p>
        <Link href="/create?type=player" className="card mt-6 flex items-center gap-4 border-lime/50 p-4 transition hover:border-lime">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-lime/10 text-3xl">＋</span>
          <span className="flex-1">
            <span className="block font-bold">{es ? "Crear un diseño nuevo" : "Create a new design"}</span>
            <span className="block text-xs text-muted">
              {es
                ? "Haz la primera tarjeta; al terminar toca \"Siguiente jugador — mismo diseño\"."
                : "Make the first card; when it's done tap \"Next player — same design\"."}
            </span>
          </span>
          <span className="text-muted">›</span>
        </Link>
        {cards.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wider text-muted">
              {es ? "O usa el diseño de una tarjeta tuya" : "Or use the design of one of your cards"}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.map((c) => (
                <Link key={c.id} href={`/create?match=${c.id}`} className="card group overflow-hidden transition hover:border-lime">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.finalUrl!} alt="" className="aspect-[4/5] w-full object-cover" />
                  <span className="block px-2 py-2 text-center text-xs font-bold text-lime group-hover:text-white">
                    {es ? "Usar este diseño" : "Use this design"} ›
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const initial = TYPES.find((x) => x === type?.toUpperCase());

  const cats = await visibleCategories();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display mb-6 text-center text-4xl">{t("create_title")}</h1>
      <CreateWizard
        templates={templates}
        credits={user.credits}
        cost={await getNumberSetting("pro_cost")}
        proEnabled={proConfigured()}
        initialLayout={initial}
        categories={cats}
      />
    </div>
  );
}
