"use client";

import { BannerCanvas } from "./BannerCanvas";
import { SAMPLE_INPUTS, type ClientTemplate } from "@/lib/samples";
import { DEFAULT_DESIGN } from "@/lib/templates";
import { thumb } from "@/lib/thumb";

/** Live preview of a template with sample text and the procedural background. */
export function TemplateThumb({ template, eager, isAdmin }: { template: ClientTemplate; eager?: boolean; isAdmin?: boolean }) {
  // Admins: a style without a sample yet shows its Pro AI style reference instead, so they can see what it copies.
  if (!template.thumbUrl && isAdmin && template.styleRefUrl) template = { ...template, thumbUrl: template.styleRefUrl };
  if (template.thumbUrl)
    return (
      // Shimmer behind the picture while it loads, then it fades in.
      <span className="block aspect-[4/5] w-full animate-pulse bg-gradient-to-br from-panel-2 via-line/60 to-panel-2 [animation-duration:1.4s]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb(template.thumbUrl, 420)}
          alt={template.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          onLoad={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.parentElement?.classList.remove("animate-pulse");
          }}
          style={{ opacity: 0, transition: "opacity .25s" }}
          className="block aspect-[4/5] w-full object-cover"
        />
      </span>
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
