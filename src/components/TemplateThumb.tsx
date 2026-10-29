"use client";

import { BannerCanvas } from "./BannerCanvas";
import { SAMPLE_INPUTS, type ClientTemplate } from "@/lib/samples";
import { DEFAULT_DESIGN } from "@/lib/templates";

/** Live preview of a template with sample text and the procedural background. */
export function TemplateThumb({ template }: { template: ClientTemplate }) {
  if (template.thumbUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={template.thumbUrl} alt={template.name} loading="lazy" className="block aspect-[4/5] w-full object-cover" />
    );
  return (
    <BannerCanvas
      layout={template.layout}
      style={template.style}
      inputs={SAMPLE_INPUTS[template.layout]}
      design={{ ...DEFAULT_DESIGN, seed: template.slug.length * 97 }}
    />
  );
}
