"use client";

import { BannerCanvas } from "./BannerCanvas";
import { SAMPLE_INPUTS, type ClientTemplate } from "@/lib/samples";
import { DEFAULT_DESIGN } from "@/lib/templates";

/** Live preview of a template with sample text and the procedural background. */
export function TemplateThumb({ template }: { template: ClientTemplate }) {
  return (
    <BannerCanvas
      layout={template.layout}
      style={template.style}
      inputs={SAMPLE_INPUTS[template.layout]}
      design={{ ...DEFAULT_DESIGN, seed: template.slug.length * 97 }}
    />
  );
}
