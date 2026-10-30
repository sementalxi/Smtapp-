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
  if (!banner || banner.userId !== user.id) notFound();

  if (banner.status !== "READY") {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl">{banner.status === "FAILED" ? t("failed") : t("processing")}</h1>
        {banner.status === "FAILED" && <p className="mt-3 text-sm text-muted">{t("err_generic")}</p>}
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
                  templateId: banner.templateId,
                  templates: (await db.template.findMany({ orderBy: [{ layout: "asc" }, { sort: "asc" }], select: { id: true, name: true, layout: true } })).map((x) => ({
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
