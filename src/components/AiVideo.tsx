"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { sfx } from "@/lib/sfx";

type Job = { id: string; status: string; videoUrl: string | null; seconds?: number; error: string | null };
const MOTIONS: [string, string, string, string][] = [
  ["ultra", "⭐", "Ultra — recommended", "Ultra — recomendado"],
  ["epic", "🎥", "Epic camera", "Cámara épica"],
  ["celebrate", "🙌", "Celebration", "Celebración"],
  ["walk", "🚶", "Walk-out", "Entrada épica"],
  ["orbit", "🔄", "360 orbit", "Giro 360"],
  ["fire", "🔥", "Fire & smoke", "Fuego y humo"],
];

/** Real AI video (Kling) from a finished poster — paid with credits. */
export function AiVideo({ bannerId, title }: { bannerId: string; title: string }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [info, setInfo] = useState<{ on: boolean; five: number; ten: number; audioCost: number; credits: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState<5 | 10>(5);
  const [audio, setAudio] = useState(false); // silent by default (cheaper; add music later in TikTok/Reels)
  const [motion, setMotion] = useState("ultra");
  const [extra, setExtra] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch(`/api/video?bannerId=${bannerId}`).then((r) => r.json()).catch(() => null);
    if (!d) return;
    setInfo({ on: d.on, five: d.five, ten: d.ten, audioCost: d.audioCost ?? 5, credits: d.credits });
    const last = (d.jobs as Job[])?.[0];
    if (last && (last.status === "running" || last.status === "queued" || last.status === "done")) setJob(last);
  }, [bannerId]);
  useEffect(() => { load(); }, [load]);

  // Poll while it's being made (it keeps going on the server even if they leave).
  useEffect(() => {
    if (!job || (job.status !== "running" && job.status !== "queued")) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/video/${job.id}`).then((r) => r.json()).catch(() => null);
      if (!d) return;
      setJob((j) => (j ? { ...j, ...d } : j));
      if (d.status === "done") { sfx("done"); router.refresh(); }
      if (d.status === "failed") { sfx("error"); setErr(d.error === "blocked" ? (es ? "La IA no quiso animar esta imagen (filtro de seguridad). Créditos devueltos." : "The AI refused to animate this image (safety filter). Credits refunded.") : (es ? "No se pudo crear el video. Créditos devueltos." : "Couldn't make the video. Credits refunded.") + (d.detail ? ` — ${d.detail}` : "")); }
    }, 6000);
    return () => clearInterval(t);
  }, [job, es, router]);

  if (!info?.on) return null;
  const cost = (seconds === 10 ? info.ten : info.five) + (audio ? info.audioCost : 0);

  async function make() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bannerId, seconds, audio, motion, extra: extra.trim() || undefined }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.id) {
      sfx("error");
      return setErr((d.error === "not_enough_credits" ? (es ? `Necesitas ${cost} créditos.` : `You need ${cost} credits.`) : es ? "No se pudo empezar el video (créditos devueltos)." : "Couldn't start the video (credits refunded).") + (d.detail ? ` — ${d.detail}` : ""));
    }
    sfx("send");
    setInfo((i) => (i ? { ...i, credits: i.credits - cost } : i));
    setJob({ id: d.id, status: "running", videoUrl: null, error: null });
    router.refresh();
  }

  async function save(url: string) {
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const f = new File([blob], `${title.replace(/[^\w-]+/g, "_") || "kixo"}.mp4`, { type: "video/mp4" });
      if (navigator.canShare?.({ files: [f] })) return void (await navigator.share({ files: [f] }));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = f.name;
      a.click();
    } catch {}
  }

  const making = job && (job.status === "running" || job.status === "queued");
  return (
    <div className="mb-2">
      {!open && !job && (
        <button type="button" onClick={() => setOpen(true)} className="group flex w-full items-center gap-3 rounded-xl border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/20 via-lime/10 to-transparent p-3 text-left transition hover:border-fuchsia-300">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-fuchsia-500/20 text-2xl">✨</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-bold">{es ? "Video con IA" : "AI video"} <span className="rounded-full bg-fuchsia-400 px-1.5 py-0.5 text-[9px] font-extrabold text-ink">NEW</span></span>
            <span className="block text-xs text-muted">{es ? `Tu póster cobra vida con movimiento real · desde ⚡${info.five}` : `Your poster comes alive with real motion · from ⚡${info.five}`}</span>
          </span>
          <span className="text-fuchsia-300 transition group-hover:translate-x-0.5">›</span>
        </button>
      )}

      {open && !job && (
        <div className="space-y-3 rounded-2xl border border-fuchsia-400/40 bg-panel-2/60 p-3">
          <div className="flex items-center justify-between">
            <span className="font-bold">✨ {es ? "Video con IA" : "AI video"}</span>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">✕</button>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">{es ? "Movimiento" : "Motion"}</div>
            <div className="flex flex-wrap gap-1.5">
              {MOTIONS.map(([k, icon, en, esL]) => (
                <button key={k} type="button" onClick={() => setMotion(k)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${k === "ultra" ? "w-full py-2 text-sm " : ""}${motion === k ? (k === "ultra" ? "border-amber-300 bg-gradient-to-r from-amber-400/30 to-fuchsia-500/30 text-white shadow-[0_0_20px_-6px] shadow-amber-300" : "border-fuchsia-300 bg-fuchsia-500/20 text-white") : k === "ultra" ? "border-amber-300/50 text-amber-200" : "border-line text-muted"}`}>
                  {icon} {es ? esL : en}
                </button>
              ))}
            </div>
          </div>
          <input className="input text-sm" maxLength={300} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={es ? "Opcional: ¿qué más pasa? (ej. lluvia, fuegos artificiales)" : "Optional: anything else? (e.g. rain, fireworks)"} />
          <div className="grid grid-cols-2 gap-2">
            {([5, 10] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSeconds(s)} className={`rounded-xl border px-3 py-2 text-sm font-bold ${seconds === s ? "border-fuchsia-300 bg-fuchsia-500/20" : "border-line text-muted"}`}>
                {s}s · ⚡{s === 10 ? info.ten : info.five}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} /> 🔊 {es ? "Agregar sonido (estadio, música)" : "Add sound (stadium, music)"} {info.audioCost > 0 && <b className="text-fuchsia-300">+⚡{info.audioCost}</b>}
          </label>
          <button type="button" disabled={busy || info.credits < cost} onClick={make} className="btn-primary w-full py-3">
            {busy ? "…" : info.credits < cost ? (es ? `Necesitas ⚡${cost}` : `Need ⚡${cost}`) : es ? `✨ Crear video · ⚡${cost}` : `✨ Make video · ⚡${cost}`}
          </button>
          <p className="text-center text-[11px] text-muted">{es ? "Tarda 1–3 minutos. Si falla, se devuelven los créditos." : "Takes 1–3 minutes. If it fails, credits are refunded."}</p>
        </div>
      )}

      {making && (
        <div className="flex items-center gap-3 rounded-2xl border border-fuchsia-400/40 bg-panel-2/60 p-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-300 border-t-transparent" />
          <span className="text-sm">
            <b>{es ? "Creando tu video con IA…" : "Making your AI video…"}</b>
            <span className="block text-xs text-muted">{es ? "1–3 minutos. Puedes salir; te espera aquí y en Historial." : "1–3 minutes. You can leave — it'll be waiting here."}</span>
          </span>
        </div>
      )}

      {job?.status === "done" && job.videoUrl && (
        <div className="space-y-2 rounded-2xl border border-fuchsia-400/40 bg-panel-2/60 p-3">
          <video src={job.videoUrl} controls playsInline loop autoPlay muted className="w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => save(job.videoUrl!)} className="btn-primary py-2.5 text-sm">{es ? "📲 Guardar video" : "📲 Save video"}</button>
            <button type="button" onClick={() => { setJob(null); setOpen(true); }} className="btn-ghost py-2.5 text-sm">{es ? "✨ Otro video" : "✨ Another"}</button>
          </div>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
