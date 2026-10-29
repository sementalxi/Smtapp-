"use client";

import { useRef, useState } from "react";

/**
 * Downscales big photos in the browser before uploading. Serverless hosts cap
 * request bodies (~4.5 MB on Vercel), and the AI models don't need more pixels.
 * PNG/WebP keep transparency; JPEGs stay JPEG.
 */
async function shrink(file: File): Promise<Blob> {
  const keepAlpha = file.type !== "image/jpeg";
  const max = keepAlpha ? 1600 : 2048;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const type = keepAlpha ? "image/png" : "image/jpeg";
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.9));
    return out ?? file;
  } catch {
    return file;
  }
}

export function ImageDrop({
  label,
  hint,
  kind,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  kind: "photo" | "logo";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  async function upload(file: File) {
    setErr("");
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setErr("JPG, PNG, WebP");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", await shrink(file), file.name);
    fd.append("kind", kind);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.url) onChange(data.url);
    else setErr(data.error ?? "Upload failed");
  }

  return (
    <div>
      <span className="label">{label}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={`relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
          drag ? "border-lime bg-lime/5" : "border-line bg-panel-2 hover:border-muted"
        }`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain p-2" />
        ) : (
          <span className="px-4 text-center text-sm text-muted">{busy ? "…" : "＋"}</span>
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-ink/70 text-sm">…</span>}
      </button>
      <div className="mt-1 flex items-center justify-between gap-2">
        {hint && <p className="text-xs text-muted">{hint}</p>}
        {value && (
          <button type="button" className="text-xs text-danger" onClick={() => onChange(null)}>
            ✕
          </button>
        )}
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
