import { crestModeLabel } from "@/lib/templates";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { aiConfigured } from "@/lib/banners";
import { BannerEditor } from "@/components/BannerEditor";
import { ProBannerView } from "@/components/ProBannerView";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getNumberSetting } from "@/lib/settings";
import { BannerInputs, DEFAULT_DESIGN, DesignState, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";

export const metadata = { title: "Editor" };

export default async function BannerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const { id } = await params;
  const banner = await db.banner.findUnique({ where: { id }, include: { template: true } });
  const isAdmin = user.role === "ADMIN";
  if (!banner || (banner.userId !== user.id && !isAdmin)) notFound();
  const owner = banner.userId !== user.id ? await db.user.findUnique({ where: { id: banner.userId }, select: { email: true } }) : null;

  if (banner.status !== "READY") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl">{banner.status === "FAILED" ? t("failed") : t("processing")}</h1>
        {banner.status === "FAILED" && <p className="mt-3 text-sm text-muted">{t("err_generic")}</p>}
        {isAdmin && banner.error && <p className="mt-3 break-words text-xs text-danger">{banner.error}</p>}
        {isAdmin && banner.prompt && (
          <details className="mt-4 rounded-xl border border-dashed border-line p-3 text-left text-xs">
            <summary className="cursor-pointer font-bold text-muted">Admin · see what the AI was asked</summary>
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-[11px] text-muted [overflow-wrap:anywhere]">{banner.prompt}</pre>
          </details>
        )}
        {banner.status !== "FAILED" && <AutoRefresh seconds={4} times={150} />}
        <Link href="/create" className="btn-primary mt-8">{t("new_banner")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-muted hover:text-white">← {t("back")}</Link>
        <h1 className="font-display text-4xl">{banner.title}</h1>
      </div>
      {owner && (
        <p className="-mt-3 mb-5 rounded-xl border border-lime/30 bg-lime/5 px-4 py-2 text-xs">
          🛡️ Admin view · {owner.email} — {t("back") === "Atrás" ? "tus ediciones son gratis y se guardan en su cuenta." : "your edits are free and saved to their account."}
        </p>
      )}
      {banner.mode === "PRO" ? (
        <ProBannerView
          id={banner.id}
          title={banner.title}
          imageUrl={banner.finalUrl}
          inputs={{ ...EMPTY_INPUTS, ...(banner.inputs as unknown as Partial<BannerInputs>) }}
          layout={banner.template.layout}
          cost={await getNumberSetting("pro_cost")}
          credits={user.credits}
          admin={
            user.role === "ADMIN"
              ? {
                  prompt: banner.prompt,
                  hasInstructions: !!banner.template.proInstructions?.trim(),
                  templateName: banner.template.name,
                  crest: crestModeLabel(banner.inputs as { aiLogo?: string } | null, !!banner.logoUrl),
                  templateId: banner.templateId,
                  templates: (await db.template.findMany({ where: { deletedAt: null }, orderBy: [{ layout: "asc" }, { sort: "asc" }], select: { id: true, name: true, layout: true } })).map((x) => ({
                    id: x.id,
                    name: `${x.name} (${x.layout.toLowerCase()})`,
                  })),
                }
              : undefined
          }
        />
      ) : (
      <BannerEditor
        banner={{
          id: banner.id,
          title: banner.title,
          inputs: { ...EMPTY_INPUTS, ...(banner.inputs as unknown as Partial<BannerInputs>) },
          design: { ...DEFAULT_DESIGN, ...((banner.design ?? {}) as unknown as Partial<DesignState>) },
          backgroundUrl: banner.backgroundUrl,
          cutoutUrl: banner.cutoutUrl,
          logoUrl: banner.logoUrl,
        }}
        layout={banner.template.layout}
        style={banner.template.style as unknown as TemplateStyle}
        cost={aiConfigured() ? banner.template.cost : 0}
        credits={user.credits}
      />
      )}
    </div>
  );
}
