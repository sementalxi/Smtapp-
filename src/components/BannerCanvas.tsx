"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { canvasFonts } from "@/app/fonts";
import { loadImage, renderBanner, type RenderAssets } from "@/lib/render/renderer";
import type { BannerInputs, DesignState, LayoutKind, TemplateStyle } from "@/lib/templates";
import { loadBannerFonts } from "./useBannerFonts";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "BannerForge";

export interface BannerCanvasProps {
  layout: LayoutKind;
  style: TemplateStyle;
  inputs: BannerInputs;
  design: DesignState;
  backgroundUrl?: string | null;
  cutoutUrl?: string | null;
  logoUrl?: string | null;
  watermark?: string;
  className?: string;
}

export interface BannerCanvasHandle {
  toBlob: (type?: "image/png" | "image/jpeg") => Promise<Blob | null>;
}

const cache = new Map<string, Promise<HTMLImageElement>>();
function cachedImage(url: string) {
  if (!cache.has(url)) cache.set(url, loadImage(url));
  return cache.get(url)!;
}

async function load(url?: string | null) {
  if (!url) return null;
  try {
    return await cachedImage(url);
  } catch {
    cache.delete(url);
    return null;
  }
}

export const BannerCanvas = forwardRef<BannerCanvasHandle, BannerCanvasProps>(function BannerCanvas(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<RenderAssets | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    toBlob: (type = "image/png") =>
      new Promise((res) => {
        const c = canvasRef.current;
        if (!c) return res(null);
        c.toBlob((b) => res(b), type, 0.92);
      }),
  }));

  useEffect(() => {
    loadBannerFonts().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([load(props.backgroundUrl), load(props.cutoutUrl), load(props.logoUrl)]).then(([background, cutout, logo]) => {
      if (alive) setAssets({ background, cutout, logo });
    });
    return () => {
      alive = false;
    };
  }, [props.backgroundUrl, props.cutoutUrl, props.logoUrl]);

  useEffect(() => {
    if (!assets || !fontsReady || !canvasRef.current) return;
    const id = requestAnimationFrame(() => {
      renderBanner(canvasRef.current!, {
        layout: props.layout,
        style: props.style,
        inputs: props.inputs,
        design: props.design,
        assets,
        fonts: canvasFonts,
        brand: site,
        watermark: props.watermark,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [assets, fontsReady, props.layout, props.style, props.inputs, props.design, props.watermark]);

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1350}
      className={`block aspect-[4/5] w-full bg-panel-2 ${props.className ?? ""}`}
    />
  );
});
