"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { useT } from "@/i18n/client";

/** Admin: choose the home page background — the KIXO picture, your own video, or nothing. */
export function HeroBackground({ initial, blobReady }: { initial: { mode: string; video: string; opacity: number }; blobReady: boolean }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [mode, setMode] = useState(initial.mode || "image");
  const [video, setVideo] = useState(initial.video);
  const [opacity, setOpacity] = useState(initial.opacity || 70);
  const [pct, setPct] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setMsg("");
    if (!/^video\/(mp4|webm|quicktime)$/.test(f.type)) return setMsg(es ? "Usa un video MP4 (o WebM)." : "Use an MP4 (or WebM) video.");
    setPct(0);
    try {
      const b = await upload(`hero/${Date.now()}-${f.name.replace(/[^a-z0-9.]+/gi, "-")}`, f, {
        access: "public",
        handleUploadUrl: "/api/admin/hero-video",
        contentType: f.type,
        onUploadProgress: (p) => setPct(Math.round(p.percentage)),
      });
      setVideo(b.url);
      setMode("video");
      setMsg(es ? "✅ Video subido — toca Guardar" : "✅ Video uploaded — tap Save");
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "upload failed"}`);
    }
    setPct(null);
  }

  async function save() {
    setBusy(true);
    const r = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hero_bg_mode: mode, hero_video: video, hero_video_opacity: opacity }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setMsg(es ? "✅ Guardado — ya se ve en la página principal" : "✅ Saved — live on the home page");
      router.refresh();
    } else setMsg(`❌ ${d.detail || d.error || "error"}`);
  }

  const modes = [
    ["image", es ? "🖼️ Imagen KIXO" : "🖼️ KIXO picture"],
    ["video", es ? "🎬 Mi video" : "🎬 My video"],
    ["none", es ? "⬛ Solo efectos" : "⬛ Effects only"],
  ] as const;

  return (
    <div className="card max-w-xl space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold">🎬 {es ? "Fondo de la página principal" : "Home page background"}</h2>
        <p className="text-sm text-muted">
          {es
            ? "Pon un video en movimiento detrás del título (estadio, humo, luces…). Las luces, la niebla y el logo animado siguen encima."
            : "Put a moving video behind the title (stadium, smoke, lights…). The light beams, fog and animated logo stay on top."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {modes.map(([m, label]) => (
          <button key={m} type="button" onClick={() => { setMode(m); setMsg(""); }} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${mode === m ? "border-lime bg-lime/10 text-lime" : "border-line text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "video" && (
        <div className="space-y-3">
          {blobReady ? (
            <>
              <input ref={file} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <button type="button" className="btn-ghost w-full py-3" disabled={pct !== null} onClick={() => file.current?.click()}>
                {pct !== null ? `${es ? "Subiendo" : "Uploading"}… ${pct}%` : `⬆️ ${es ? "Subir video (MP4)" : "Upload video (MP4)"}`}
              </button>
              {pct !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-lime transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-teal/40 bg-teal/5 p-3 text-xs text-muted">
              {es
                ? "Para subir videos desde aquí, conecta Vercel Blob: en Vercel → tu proyecto → Storage → Create → Blob → Connect, y vuelve a desplegar. Mientras tanto puedes pegar un enlace https a un MP4 abajo."
                : "To upload videos from here, connect Vercel Blob: in Vercel → your project → Storage → Create → Blob → Connect, then redeploy. Meanwhile you can paste an https link to an MP4 below."}
            </p>
          )}
          <div>
            <label className="label">{es ? "o enlace del video (https…mp4)" : "or video link (https…mp4)"}</label>
            <input className="input text-sm" value={video} placeholder="https://…/stadium.mp4" onChange={(e) => setVideo(e.target.value.trim())} />
          </div>
          {video && (
            <video src={video} muted loop autoPlay playsInline className="aspect-video w-full rounded-xl border border-line object-cover" style={{ opacity: opacity / 100 }} />
          )}
          <div>
            <label className="label">{es ? "Brillo del video" : "Video brightness"}: {opacity}%</label>
            <input type="range" min={10} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[#b7ff45]" />
          </div>
          <p className="text-[11px] text-muted">
            {es
              ? "Consejo: usa un video corto (5–15 s) que se repita, horizontal, MP4 de menos de 20 MB. Se reproduce sin sonido."
              : "Tip: use a short looping clip (5–15 s), landscape, MP4 under 20 MB. It plays muted."}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary px-6" disabled={busy || (mode === "video" && !video)} onClick={save}>
          {busy ? "…" : es ? "Guardar" : "Save"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
