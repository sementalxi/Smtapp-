import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { aiConfigured } from "@/lib/banners";
import { canRemoveBackground, proConfigured } from "@/lib/ai";
import { getNumberSetting } from "@/lib/settings";
import { CreateForm } from "@/components/CreateForm";

export const metadata = { title: "Create" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const templates = await activeTemplates();
  const { t: slug } = await searchParams;
  const proCost = await getNumberSetting("pro_cost");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display mb-8 text-5xl">{t("create_title")}</h1>
      {!aiConfigured() && (
        <p className="card mb-6 border-amber-400/40 p-4 text-sm text-amber-200">
          Demo mode: no AI key is configured, so generation is free and uses the built-in backgrounds. Add OPENAI_API_KEY
          (or REPLICATE_API_TOKEN) in Vercel to enable AI.
        </p>
      )}
      {aiConfigured() && !canRemoveBackground() && user.role === "ADMIN" && (
        <p className="card mb-6 p-4 text-xs text-muted">
          Admin note: Quick mode paints AI backgrounds with OpenAI, but can&apos;t cut the player out of the photo without a
          REPLICATE_API_TOKEN — users should upload photos with a transparent background, or use Pro AI.
        </p>
      )}
      {templates.length ? (
        <CreateForm
          templates={templates}
          credits={user.credits}
          initialSlug={slug}
          aiEnabled={aiConfigured()}
          proEnabled={proConfigured()}
          proCost={proCost}
        />
      ) : (
        <p className="text-muted">No templates yet — run <code>npm run db:seed</code>.</p>
      )}
    </div>
  );
}
