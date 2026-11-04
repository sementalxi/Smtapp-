import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/settings";
import { activeTemplates } from "@/lib/queries";
import { getRun } from "@/lib/style-test";
import type { Sample } from "@/lib/style-test-inputs";
import { StyleTestRunner, type TestResult, type TestTemplate } from "@/components/admin/StyleTestRunner";

export const dynamic = "force-dynamic";

/** Admin → Style test: one poster per style, made one by one with a shared sample, with how each came out. */
export default async function AdminStyleTest() {
  const admin = await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const [tpls, settings, banners, run] = await Promise.all([
    activeTemplates(admin),
    getSettings(),
    db.banner.findMany({ where: { userId: admin.id }, orderBy: { createdAt: "desc" }, take: 400, include: { template: { select: { name: true, layout: true } } } }),
    getRun().catch(() => null),
  ]);
  const templates: TestTemplate[] = tpls.map((t) => ({
    id: t.id,
    name: t.name,
    layout: t.layout,
    logoCreate: !!t.logoCreate,
    hasInstructions: !!t.hasInstructions,
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
      <StyleTestRunner templates={templates} initialSample={sample} initialResults={results} initialRun={run} />
    </div>
  );
}
