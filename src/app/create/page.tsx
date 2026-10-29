import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { aiConfigured } from "@/lib/banners";
import { proConfigured } from "@/lib/ai";
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
          Demo mode: no AI key is configured, so generation is free and uses the built-in backgrounds without cutting out the
          photo. Add REPLICATE_API_TOKEN (or OPENAI_API_KEY) to enable AI.
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
