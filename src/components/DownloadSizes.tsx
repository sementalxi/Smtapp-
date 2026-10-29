"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

type Size = { id: string; w: number; h: number; en: string; es: string; sub: string };

const SIZES: Size[] = [
  { id: "post", w: 1080, h: 1350, en: "Post", es: "Post", sub: "4:5" },
  { id: "story", w: 1080, h: 1920, en: "Story", es: "Historia", sub: "9:16" },
  { id: "banner", w: 1920, h: 1080, en: "Banner", es: "Banner", sub: "16:9" },
];

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load failed"));
    img.src = src;
  });
}

/**
 * Re-frames the poster for other formats in the browser (free): the poster is
 * centred and the extra space is filled with a blurred, darkened copy of it.
 */
async function reframe(src: string, w: number, h: number): Promise<Blob | null> {
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // Background: cover-fit, blurred by downscaling (works in every browser).
  const cover = Math.max(w / img.width, h / img.height);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(w / 24));
  small.height = Math.max(1, Math.round(h / 24));
  const sctx = small.getContext("2d")!;
  sctx.drawImage(img, (small.width - img.width * cover / 24) / 2, (small.height - img.height * cover / 24) / 2, (img.width * cover) / 24, (img.height * cover) / 24);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, -w * 0.05, -h * 0.05, w * 1.1, h * 1.1);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, w, h);

  // Foreground: the full poster, contained, with a soft shadow.
  const fit = Math.min(w / img.width, h / img.height);
  const fw = img.width * fit;
  const fh = img.height * fit;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40;
  ctx.drawImage(img, (w - fw) / 2, (h - fh) / 2, fw, fh);

  return new Promise((r) => c.toBlob(r, "image/png"));
}

export function DownloadSizes({
  src,
  baseName,
  primary = "post",
}: {
  /** Image URL, or a function that produces one (e.g. from the editor canvas). */
  src: string | (() => Promise<string | null>);
  baseName: string;
  primary?: string;
}) {
  const { locale } = useT();
  const [busy, setBusy] = useState("");

  async function go(size: Size) {
    setBusy(size.id);
    try {
      const url = typeof src === "string" ? src : await src();
      if (!url) return;
      const blob = await reframe(url, size.w, size.h);
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${baseName.replace(/[^\w-]+/g, "_") || "kixo"}-${size.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!!busy}
            onClick={() => go(s)}
            className={`${s.id === primary ? "btn-primary" : "btn-ghost"} flex-col gap-0 px-2 py-2.5`}
          >
            <span>{busy === s.id ? "…" : `⬇ ${locale === "es" ? s.es : s.en}`}</span>
            <span className="text-[10px] font-semibold opacity-70">
              {s.sub} · {s.w}×{s.h}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        {locale === "es" ? "Todos los tamaños gratis" : "All sizes are free"}
      </p>
    </div>
  );
}
