import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/settings";
import { getRun } from "@/lib/style-test";
import type { Sample, SyncCard, SyncLeague } from "@/lib/style-test-inputs";
import { thumb } from "@/lib/thumb";
import { StyleTestRunner, type TestResult, type TestTemplate } from "@/components/admin/StyleTestRunner";

export const dynamic = "force-dynamic";

/** Admin → Style test: one poster per style, made one by one with a shared sample, with how each came out. */
export default async function AdminStyleTest() {
  const admin = await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  // Every style that exists in Admin → Styles (hidden ones too, marked), always fresh — same list, same order.
  const [tpls, settings, banners, run] = await Promise.all([
    db.template.findMany({ where: { deletedAt: null }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, layout: true, active: true, proInstructions: true } }),
    getSettings(),
    db.banner.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" }, take: 400, include: { template: { select: { name: true, layout: true } } } }),
    getRun().catch(() => null),
  ]);
  // "Sync from my data": the admin's own finished player cards and saved league tables.
  const [cardRows, myLeagues, official, tables, myTeams] = await Promise.all([
    db.banner.findMany({ where: { userId: admin.id, mode: "PRO", status: "READY", template: { layout: "PLAYER" } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, finalUrl: true, photoUrl: true, logoUrl: true, inputs: true, design: true } }),
    db.savedItem.findMany({ where: { userId: admin.id, kind: "championship" }, select: { id: true, name: true, logoUrl: true } }),
    db.libraryItem.findMany({ where: { kind: "championship" }, select: { id: true, name: true, logoUrl: true } }),
    db.setting.findMany({ where: { key: { startsWith: `standings:${admin.id}:` } } }),
    db.savedItem.findMany({ where: { userId: admin.id, kind: "team" }, select: { name: true, logoUrl: true } }),
  ]);
  const cards: SyncCard[] = cardRows
    .filter((b) => !(b.design as unknown as { styleTest?: string } | null)?.styleTest && b.photoUrl)
    .map((b) => {
      const i = (b.inputs ?? {}) as Record<string, string>;
      return { id: b.id, label: [i.name, i.team].filter(Boolean).join(" · ") || b.title, thumb: thumb(b.finalUrl, 160), photoUrl: b.photoUrl ?? "", logoUrl: b.logoUrl ?? "", inputs: { name: i.name ?? "", team: i.team ?? "", position: i.position ?? "", number: i.number ?? "", tagline: i.tagline ?? "", subtitle: i.subtitle ?? "", footer: i.footer ?? "" } };
    });
  const crest = (team: string) => myTeams.find((m) => m.name.trim().toLowerCase() === team.trim().toLowerCase())?.logoUrl ?? "";
  const leagues: SyncLeague[] = [];
  for (const t of tables) {
    try {
      const id = t.key.slice(`standings:${admin.id}:`.length);
      const meta = myLeagues.find((l) => l.id === id) ?? official.find((l) => l.id === id);
      const v = JSON.parse(t.value) as { rows?: { team: string; p: string; w: string; d: string; l: string; gd: string; pts: string }[]; date?: string; qualify?: string };
      const rows = (v.rows ?? []).filter((r) => r.team?.trim()).slice(0, 20);
      if (!meta || !rows.length) continue;
      const line = (r: (typeof rows)[number], n: number) =>
        [`${n + 1}. ${r.team.trim()}`, ...([["P", r.p], ["W", r.w], ["D", r.d], ["L", r.l], ["GD", r.gd], ["PTS", r.pts]] as const).filter(([, x]) => (x ?? "").trim()).map(([k, x]) => `${k} ${x.trim()}`)].join(" · ");
      leagues.push({ id, name: meta.name, logoUrl: meta.logoUrl ?? "", standings: rows.map(line), tableLogos: rows.map((r) => crest(r.team)), teams: rows.map((r) => ({ name: r.team.trim(), logoUrl: crest(r.team) })), qualify: v.qualify ?? "", date: v.date ?? "" });
    } catch {
      /* skip a broken table */
    }
  }
  const templates: TestTemplate[] = tpls.map((t) => ({
    id: t.id,
    name: t.name,
    layout: t.layout,
    logoCreate: /\[LOGO CREATE\]/.test(t.proInstructions ?? ""),
    hasInstructions: !!t.proInstructions?.trim(),
    hidden: !t.active,
  }));
  let sample: Sample | null = null;
  try {
    sample = settings.style_test_sample ? (JSON.parse(settings.style_test_sample) as Sample) : null;
  } catch {
    sample = null;
  }
  const results: TestResult[] = banners
    .filter((b) => !!(b.design as unknown as { styleTest?: string } | null)?.styleTest)
    .map((b) => ({
      bannerId: b.id,
      templateId: b.templateId,
      templateName: b.template?.name ?? "",
      layout: b.template?.layout ?? "",
      status: b.status === "READY" ? "READY" : b.status === "FAILED" ? "FAILED" : "PROCESSING",
      finalUrl: b.finalUrl,
      error: b.error,
      madeWith: b.prompt?.match(/^\[Made with: ([^\]]+)\]/)?.[1] ?? null,
      seconds: b.status === "READY" || b.status === "FAILED" ? Math.max(1, Math.round((b.updatedAt.getTime() - b.createdAt.getTime()) / 1000)) : null,
      createdAt: b.createdAt.toISOString(),
      run: String((b.design as unknown as { styleTest?: string }).styleTest),
      stage: b.stage ?? null,
    }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">🧪 {es ? "Probar estilos" : "Style test"}</h1>
        <p className="mt-1 text-sm text-muted">
          {es
            ? "Genera un póster con cada estilo de tu web, uno por uno, con la misma foto y textos — y mira cómo sale cada uno, con qué IA se hizo, cuánto tardó y si falló. Gratis para el admin; cada resultado queda en tu historial. La ronda corre en el servidor: puedes cerrar la página y volver después."
            : "Makes one poster with every style on your site, one by one, from the same photo and texts — and shows how each came out, which AI made it, how long it took and whether it failed. Free for admin; every result lands in your history. The run happens on the server, so you can close the page and come back later."}
        </p>
      </div>
      <StyleTestRunner templates={templates} initialSample={sample} initialResults={results} initialRun={run} cards={cards} leagues={leagues} />
    </div>
  );
}
