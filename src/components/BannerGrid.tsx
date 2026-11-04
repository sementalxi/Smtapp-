import Link from "next/link";
import type { Banner, Template } from "@prisma/client";
import { BannerPreview } from "./BannerPreview";
import { DeleteBannerButton } from "./DeleteBannerButton";
import { BannerInputs, DEFAULT_DESIGN, DesignState, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";
import { ART_TYPES } from "@/lib/pro-options";

type Row = Banner & { template: Template; user?: { email: string; id: string } };

export function BannerGrid({
  banners,
  labels,
  admin,
  es,
}: {
  banners: Row[];
  labels: { processing: string; failed: string; open: string };
  admin?: boolean;
  /** Spanish labels (art type + style names). */
  es?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {banners.map((b) => {
        const ready = b.status === "READY";
        const preview = (
          <BannerPreview
            finalUrl={b.finalUrl}
            layout={b.template.layout}
            style={b.template.style as unknown as TemplateStyle}
            inputs={{ ...EMPTY_INPUTS, ...(b.inputs as unknown as Partial<BannerInputs>) }}
            design={{ ...DEFAULT_DESIGN, ...((b.design ?? {}) as unknown as Partial<DesignState>) }}
            backgroundUrl={b.backgroundUrl}
            cutoutUrl={b.cutoutUrl}
            logoUrl={b.logoUrl}
          />
        );
        return (
          <div key={b.id} className="card relative overflow-hidden">
            {b.mode === "PRO" && (
              <span className="chip absolute top-2 left-2 z-10 border-lime bg-ink/70 text-[10px] text-lime">✨ PRO</span>
            )}
            {ready ? (
              <Link href={`/banner/${b.id}`} className="block transition hover:opacity-90">{preview}</Link>
            ) : admin ? (
              <Link href={`/banner/${b.id}`} className="grid aspect-[4/5] place-items-center bg-panel-2 text-sm text-muted hover:text-white">
                {b.status === "FAILED" ? labels.failed : labels.processing}
              </Link>
            ) : (
              <div className="grid aspect-[4/5] place-items-center bg-panel-2 text-sm text-muted">
                {b.status === "FAILED" ? labels.failed : labels.processing}
              </div>
            )}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{b.title}</div>
                  {admin && b.user && (
                    <Link href={`/admin/users/${b.user.id}`} className="block truncate text-xs text-muted hover:text-lime">{b.user.email}</Link>
                  )}
                </div>
                <DeleteBannerButton id={b.id} />
              </div>
              {/* What was picked: the art type and the style (e.g. "Player card · Royal Lion") */}
              {(() => {
                const art = ART_TYPES.find((a) => a.layout === b.template.layout);
                const style = (es ? b.template.nameEs : b.template.name) || b.template.name;
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {art && <span className="chip text-[10px] text-muted">{art.icon} {es ? art.es.name : art.en.name}</span>}
                    <span className="chip max-w-full truncate border-lime/40 text-[10px] text-lime" title={style}>🎨 {style}</span>
                  </div>
                );
              })()}
            </div>
            {admin && b.error && <p className="px-3 pb-2 text-[11px] text-danger">{b.error}</p>}
          </div>
        );
      })}
    </div>
  );
}
