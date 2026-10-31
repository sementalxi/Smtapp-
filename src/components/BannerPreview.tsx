"use client";

import { BannerCanvas } from "./BannerCanvas";
import type { BannerInputs, DesignState, LayoutKind, TemplateStyle } from "@/lib/templates";
import { thumb } from "@/lib/thumb";

/** Gallery thumbnail: uses the exported PNG when there is one, otherwise renders live. */
export function BannerPreview(p: {
  finalUrl: string | null;
  layout: LayoutKind;
  style: TemplateStyle;
  inputs: BannerInputs;
  design: DesignState;
  backgroundUrl: string | null;
  cutoutUrl: string | null;
  logoUrl: string | null;
}) {
  if (p.finalUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb(p.finalUrl, 480)} alt="" className="block aspect-[4/5] w-full object-cover" loading="lazy" decoding="async" />;
  }
  return (
    <BannerCanvas
      layout={p.layout}
      style={p.style}
      inputs={p.inputs}
      design={p.design}
      backgroundUrl={p.backgroundUrl}
      cutoutUrl={p.cutoutUrl}
      logoUrl={p.logoUrl}
    />
  );
}
