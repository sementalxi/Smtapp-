"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";
import { DownloadSizes } from "../DownloadSizes";
import { GenerationProgress } from "../GenerationProgress";
import { MotionCTA } from "../MotionStudio";
import { STUDIO_KINDS, STUDIO_SIZES, type StudioKind, type StudioSize } from "@/lib/studio";

type Img = { url: string | null; role: string };
const ROLE_HINTS = {
  en: ["Main person / player photo", "Team logo — put it big in the center", "Second logo (opponent / sponsor)", "Background / style reference", "Product or extra image"],
  es: ["Foto de la persona / jugador principal", "Logo del equipo — grande en el centro", "Segundo logo (rival / patrocinador)", "Fondo / referencia de estilo", "Producto o imagen extra"],
};

/** Admin-only free studio: any flyer, logo or graphic, any size, with uploaded pictures. */
export function FlyerStudio({ recent }: { recent: { url: string; at: number; kind: string; size: string }[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const L = es ? 1 : 0;
  const router = useRouter();
  const [kind, setKind] = useState<StudioKind>("flyer");
  const [size, setSize] = useState<StudioSize>("post");
  const [quality, setQuality] = useState<"medium" | "high">("high");
  const [prompt, setPrompt] = useState("");
  const [texts, setTexts] = useState("");
  const [imgs, setImgs] = useState<Img[]>([{ url: null, role: "" }]);
  const [stamp, setStamp] = useState(false);
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [out, setOut] = useState<string | null>(null);

  const setImg = (i: number, p: Partial<Img>) => setImgs((a) => a.map((x, n) => (n === i ? { ...x, ...p } : x)));

  async function go() {
    setPhase("busy");
    setErr("");
    setOut(null);
    const res = await fetch("/api/admin/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        size,
        quality,
        prompt,
        texts,
        stamp,
        images: imgs.filter((i) => i.url).map((i, n) => ({ url: i.url, role: i.role || ROLE_HINTS[es ? "es" : "en"][n] || "" })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      setErr(data.detail || data.error || "error");
      setPhase("error");
      return;
    }
    const started = Date.now();
    while (Date.now() - started < 360_000) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await fetch(`/api/admin/studio?id=${data.id}`).then((r) => r.json()).catch(() => null);
      if (s?.status === "READY") {
        setOut(s.url);
        setPhase("done");
        router.refresh();
        return;
      }
      if (s?.status === "FAILED") {
        setErr(s.error || "failed");
        setPhase("error");
        return;
      }
    }
    setErr(es ? "Tardó demasiado — inténtalo otra vez" : "Took too long — try again");
    setPhase("error");
  }

  const [w, h] = STUDIO_SIZES[size].sizes[0].split("x").map(Number);
  const canGo = prompt.trim().length >= 3 && phase !== "busy";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="card space-y-5 p-5">
        <div>
          <span className="label">{es ? "¿Qué quieres crear?" : "What do you want to make?"}</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STUDIO_KINDS) as StudioKind[]).map((k) => (
              <button key={k} type="button" onClick={() => { setKind(k); if (k === "logo") setSize("square"); }} className={`chip ${kind === k ? "border-lime bg-lime text-ink" : "text-muted"}`}>
                {STUDIO_KINDS[k].label[L]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">{es ? "Tamaño" : "Size"}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(STUDIO_SIZES) as StudioSize[]).map((s) => {
              const [sw, sh] = STUDIO_SIZES[s].sizes[0].split("x").map(Number);
              return (
                <button key={s} type="button" onClick={() => setSize(s)} className={`flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-bold transition ${size === s ? "border-lime bg-lime/10 text-lime" : "border-line text-muted hover:border-teal/60"}`}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center">
                    <span className={`block rounded-sm border-2 ${size === s ? "border-lime" : "border-muted/60"}`} style={{ width: (sw / Math.max(sw, sh)) * 28, height: (sh / Math.max(sw, sh)) * 28 }} />
                  </span>
                  {STUDIO_SIZES[s].label[L]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="label">{es ? "Tus imágenes (hasta 6)" : "Your pictures (up to 6)"}</span>
          <div className="space-y-3">
            {imgs.map((im, i) => (
              <div key={i} className="rounded-xl border border-line bg-panel-2/50 p-3">
                <ImageDrop kind={i === 0 ? "photo" : "logo"} label={`${es ? "Imagen" : "Picture"} ${i + 1}`} value={im.url} onChange={(u) => setImg(i, { url: u })} />
                <input className="input mt-2 py-2 text-sm" maxLength={120} placeholder={`${es ? "¿Qué es / cómo usarla?" : "What is it / how to use it?"} — ${ROLE_HINTS[es ? "es" : "en"][i] ?? ""}`} value={im.role} onChange={(e) => setImg(i, { role: e.target.value })} />
                {imgs.length > 1 && (
                  <button type="button" className="mt-1 text-xs text-danger" onClick={() => setImgs((a) => a.filter((_, n) => n !== i))}>
                    ✕ {es ? "Quitar" : "Remove"}
                  </button>
                )}
              </div>
            ))}
            {imgs.length < 6 && (
              <button type="button" className="btn-ghost w-full py-2 text-sm" onClick={() => setImgs((a) => [...a, { url: null, role: "" }])}>
                ＋ {es ? "Añadir otra imagen" : "Add another picture"}
              </button>
            )}
          </div>
        </div>

        <div>
          <span className="label">{es ? "Describe el diseño (escribe todo lo que quieras)" : "Describe the design (write as much as you want)"}</span>
          <textarea
            className="input min-h-36 py-2 text-sm"
            maxLength={20000}
            placeholder={es ? "Ej: Flyer de final de liga, estadio de noche con humo verde, el jugador al centro, el logo grande detrás en metal brillante…" : "E.g. League final flyer, night stadium with green smoke, the player in the center, the team logo huge behind him in shiny metal…"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div>
          <span className="label">{es ? "Textos exactos en el diseño (opcional, uno por línea)" : "Exact texts on the design (optional, one per line)"}</span>
          <textarea className="input min-h-20 py-2 text-sm" maxLength={2000} placeholder={"GRAND FINAL\nSAT 8 PM\nKIXO ARENA"} value={texts} onChange={(e) => setTexts(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted">{es ? "Calidad" : "Quality"}</span>
            <select className="input w-auto py-1.5" value={quality} onChange={(e) => setQuality(e.target.value as "medium" | "high")}>
              <option value="high">{es ? "Alta (mejor)" : "High (best)"}</option>
              <option value="medium">{es ? "Media (más rápida)" : "Medium (faster)"}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} /> {es ? "Poner logo KIXO pequeño" : "Add small KIXO logo"}
          </label>
        </div>

        <button type="button" className="btn-primary kixo-shine w-full py-3 text-base" disabled={!canGo} onClick={go}>
          {phase === "busy" ? (es ? "Creando…" : "Creating…") : `⚡ ${es ? "Crear" : "Create"} · ${w}×${h}`}
        </button>
      </div>

      <div className="space-y-3">
        <div className="card grid place-items-center overflow-hidden" style={{ aspectRatio: `${w} / ${h}` }}>
          {phase === "done" && out ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={out} alt="" className="h-full w-full object-contain" />
          ) : phase === "busy" ? (
            <GenerationProgress photo={imgs[0]?.url} expectedSeconds={quality === "high" ? 120 : 80} />
          ) : (
            <div className="p-6 text-center text-sm text-muted">{phase === "error" ? <span className="text-danger">❌ {err}</span> : es ? "Tu diseño aparecerá aquí." : "Your design will appear here."}</div>
          )}
        </div>
        {phase === "done" && out && (
          <>
            <a href={out} download={`kixo-studio-${Date.now()}.png`} className="btn-primary w-full py-3">⬇️ {es ? "Descargar original" : "Download original"}</a>
            <DownloadSizes src={out} baseName="kixo-studio" />
            <MotionCTA src={out} baseName="kixo-studio" />
            <button type="button" className="btn-ghost w-full" onClick={go}>🔁 {es ? "Otra versión" : "Another version"}</button>
          </>
        )}

        {recent.length > 0 && (
          <div className="card p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-teal">{es ? "Recientes" : "Recent"}</div>
            <div className="grid grid-cols-3 gap-2">
              {recent.map((r) => (
                <a key={r.url + r.at} href={r.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-line hover:border-lime/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt="" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
