import Link from "next/link";
import type { Banner, Template } from "@prisma/client";
import { BannerPreview } from "./BannerPreview";
import { DeleteBannerButton } from "./DeleteBannerButton";
import { BannerInputs, DEFAULT_DESIGN, DesignState, EMPTY_INPUTS, TemplateStyle } from "@/lib/templates";

type Row = Banner & { template: Template; user?: { email: string; id: string } };

export function BannerGrid({
  banners,
  labels,
  admin,
}: {
  banners: Row[];
  labels: { processing: string; failed: string; open: string };
  admin?: boolean;
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
          <div key={b.id} className="card overflow-hidden">
            {ready && !admin ? (
              <Link href={`/banner/${b.id}`} className="block transition hover:opacity-90">{preview}</Link>
            ) : ready ? (
              preview
            ) : (
              <div className="grid aspect-[4/5] place-items-center bg-panel-2 text-sm text-muted">
                {b.status === "FAILED" ? labels.failed : labels.processing}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{b.title}</div>
                <div className="truncate text-xs text-muted">
                  {admin && b.user ? (
                    <Link href={`/admin/users/${b.user.id}`} className="hover:text-lime">{b.user.email}</Link>
                  ) : (
                    b.template.name
                  )}
                </div>
              </div>
              <DeleteBannerButton id={b.id} />
            </div>
            {admin && b.error && <p className="px-3 pb-2 text-[11px] text-danger">{b.error}</p>}
          </div>
        );
      })}
    </div>
  );
}
