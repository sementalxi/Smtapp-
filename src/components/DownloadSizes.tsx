"use client";

import { useEffect, useRef, useState } from "react";
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
/** The poster exactly as made (any shape: post, story or banner) as a PNG blob. */
async function original(src: string): Promise<Blob | null> {
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext("2d")!.drawImage(img, 0, 0);
  return new Promise((r) => c.toBlob(r, "image/png"));
}

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
  const es = locale === "es";
  const [busy, setBusy] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [msg, setMsg] = useState("");
  const ready = useRef<File | null>(null);

  // Phones that can share files (iPhone, Android) get "Save to Photos". The image is prepared ahead of time
  // so the share sheet opens instantly when tapped.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const test = new File([new Blob(["x"], { type: "image/png" })], "t.png", { type: "image/png" });
        if (!navigator.canShare?.({ files: [test] })) return;
        setCanShare(true);
        const url = typeof src === "string" ? src : await src();
        if (!url || !alive) return;
        const blob = await original(url);
        if (blob && alive) ready.current = new File([blob], `${baseName.replace(/[^\w-]+/g, "_") || "kixo"}.png`, { type: "image/png" });
      } catch {}
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof src === "string" ? src : "fn"]);

  async function saveToPhotos() {
    setMsg("");
    try {
      let f = ready.current;
      if (!f) {
        setBusy("photos");
        const url = typeof src === "string" ? src : await src();
        const blob = url ? await original(url) : null;
        if (!blob) return;
        f = new File([blob], `${baseName.replace(/[^\w-]+/g, "_") || "kixo"}.png`, { type: "image/png" });
        ready.current = f;
      }
      await navigator.share({ files: [f] });
      setMsg(es ? "Toca “Guardar imagen” para mandarla a tus Fotos 📸" : "Tap “Save Image” to put it in your Photos 📸");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg(es ? "No se pudo abrir — usa ⬇ Post y luego “Guardar en Fotos”." : "Couldn't open — use ⬇ Post, then “Save to Photos”.");
    } finally {
      setBusy("");
    }
  }

  async function go(size: Size) {
    setBusy(size.id);
    try {
      const url = typeof src === "string" ? src : await src();
      if (!url) return;
      const blob = size.id === "post" ? await original(url) : await reframe(url, size.w, size.h);
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
      {canShare && (
        <button type="button" disabled={!!busy} onClick={saveToPhotos} className="btn-primary mb-2 w-full py-3 text-base">
          {busy === "photos" ? "…" : es ? "📸 Guardar en Fotos" : "📸 Save to Photos"}
        </button>
      )}
      {msg && <p className="mb-2 text-center text-xs text-lime">{msg}</p>}
      {!canShare && (
        <button type="button" disabled={!!busy} onClick={() => go(SIZES[0])} className="btn-primary w-full py-3 text-base">
          {busy ? "…" : es ? "⬇ Descargar" : "⬇ Download"}
        </button>
      )}
    </div>
  );
}
