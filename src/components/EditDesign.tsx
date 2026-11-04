"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { BannerInputs, LayoutKind } from "@/lib/templates";
import { BG_SCENES, PALETTES } from "@/lib/pro-options";
import { TextFields } from "./TextFields";
import { ImageDrop } from "./ImageDrop";
import { GenerationProgress } from "./GenerationProgress";
import { waitForBanner } from "@/lib/wait-banner";

type Part = "text" | "colors" | "background" | "photo" | "logo" | "other";

/** "Edit this design": pick what to change; the AI edits the same poster and saves a new version. */
export function EditDesign({
  id,
  layout,
  inputs: initial,
  cost,
  credits,
  imageUrl,
  onBusy,
}: {
  id: string;
  layout: LayoutKind;
  inputs: BannerInputs;
  cost: number;
  credits: number;
  imageUrl: string;
  onBusy?: (b: boolean) => void;
}) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [tab, setTab] = useState<Part>("text");
  const [text, setText] = useState(initial);
  const [colors, setColors] = useState<{ c1: string; c2?: string } | null>(null);
  const [scene, setScene] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [barDone, setBarDone] = useState(false);
  const [genStage, setGenStage] = useState<string | null>(null);

  const TABS: { id: Part; icon: string; en: string; es: string }[] = [
    { id: "text", icon: "🔤", en: "Text", es: "Texto" },
    { id: "colors", icon: "🎨", en: "Colors", es: "Colores" },
    { id: "background", icon: "🌆", en: "Background", es: "Fondo" },
    { id: "photo", icon: "🧍", en: "Photo", es: "Foto" },
    { id: "logo", icon: "🛡️", en: "Logo", es: "Logo" },
    { id: "other", icon: "✍️", en: "Describe", es: "Describir" },
  ];

  const changedText = Object.fromEntries(
    Object.entries(text).filter(([k, v]) => typeof v === "string" && v !== (initial as unknown as Record<string, unknown>)[k] && k !== "extraPrompt"),
  ) as Record<string, string>;
  const ready = Object.keys(changedText).length > 0 || !!colors || !!scene || !!photo || !!logo || note.trim().length > 2;

  async function apply() {
    setBusy(true);
    onBusy?.(true);
    setErr("");
    setGenStage("queued");
    const res = await fetch(`/api/banners/${id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(Object.keys(changedText).length ? { text: changedText } : {}),
        ...(colors ? { colors } : {}),
        ...(scene ? { scene } : {}),
        ...(photo ? { photoUrl: photo } : {}),
        ...(logo ? { logoUrl: logo } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      const w = await waitForBanner(data.id, { onStage: setGenStage });
      if (w.ok) {
        setBarDone(true);
        await new Promise((r) => setTimeout(r, 1300));
        router.push(`/banner/${data.id}`);
        return;
      }
      setErr(
        w.error === "err_credits"
          ? es ? "No tienes créditos suficientes." : "You don't have enough credits."
          : w.error === "err_blocked" || w.error === "err_photo_blocked"
            ? es ? "El filtro de seguridad de la IA bloqueó este cambio (créditos devueltos)." : "The AI's safety filter blocked this change (credits refunded)."
            : w.error === "err_ai_down"
              ? (es ? "La IA no está disponible por el momento — inténtalo de nuevo en unos minutos. Tus créditos fueron devueltos." : "The AI is temporarily unavailable — please try again in a few minutes. Your credits were refunded.") + (w.detail ? ` — ${w.detail}` : "")
            : (es ? "No se pudo editar (créditos devueltos)." : "Couldn't edit it (credits refunded).") + (w.detail ? ` — ${w.detail}` : ""),
      );
    } else {
      setErr(
        data.error === "err_credits"
          ? es ? "No tienes créditos suficientes." : "You don't have enough credits."
          : data.error === "no_changes"
            ? es ? "Elige qué cambiar primero." : "Pick something to change first."
            : es ? "Algo salió mal." : "Something went wrong.",
      );
    }
    setBusy(false);
    onBusy?.(false);
  }

  if (busy) {
    return (
      <section className="card overflow-hidden">
        <div className="mx-auto max-w-sm">
          <GenerationProgress photo={imageUrl} expectedSeconds={100} done={barDone} stage={genStage} />
        </div>
      </section>
    );
  }

  const pending = {
    text: Object.keys(changedText).length,
    colors: colors ? 1 : 0,
    background: scene ? 1 : 0,
    photo: photo ? 1 : 0,
    logo: logo ? 1 : 0,
    other: note.trim().length > 2 ? 1 : 0,
  };
  const total = Object.values(pending).reduce((a, b) => a + b, 0);
  const summary = [
    pending.text ? (es ? `Texto (${pending.text})` : `Text (${pending.text})`) : "",
    colors ? (es ? "Colores" : "Colors") : "",
    scene ? `${es ? "Fondo" : "Background"}: ${(() => { const b = BG_SCENES.find((x) => x.id === scene); return b ? (es ? b.es : b.en) : scene; })()}` : "",
    photo ? (es ? "Foto nueva" : "New photo") : "",
    logo ? (es ? "Logo nuevo" : "New logo") : "",
    pending.other ? (es ? "Tu nota" : "Your note") : "",
  ].filter(Boolean);
  const addFix = (line: string) => setNote((n) => (n.includes(line) ? n : `${n.trim()}${n.trim() ? ". " : ""}${line}`));

  return (
    <section className="card overflow-hidden border-lime/30">
      <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">✏️ {es ? "Editar este diseño" : "Edit this design"}</h2>
          <p className="text-xs text-muted">
            {es
              ? "Cambia solo lo que elijas — el resto del póster se queda igual. Se guarda como versión nueva; el original no se pierde."
              : "Only what you pick changes — the rest of the poster stays the same. Saved as a new version; the original stays."}
          </p>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-full border border-lime/50 bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime">
            {total} {es ? (total === 1 ? "cambio" : "cambios") : total === 1 ? "change" : "changes"}
          </span>
        )}
      </div>

      {/* Tabs — one panel at a time, a dot on the ones with pending changes */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-5 [scrollbar-width:none]">
        {TABS.map((p) => {
          const on = tab === p.id;
          const dot = pending[p.id] > 0;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab(p.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${on ? "border-lime bg-lime text-ink" : "border-line bg-panel-2 text-white/85 hover:border-muted"}`}
            >
              <span>{p.icon}</span>
              {es ? p.es : p.en}
              {dot && <span className={`ml-0.5 h-2 w-2 rounded-full ${on ? "bg-ink" : "bg-lime"}`} />}
            </button>
          );
        })}
      </div>

      <div className="border-t border-line bg-panel-2/40 p-4 sm:p-5">
        {tab === "text" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Cambia cualquier texto" : "Change any text"} hint={es ? "Solo se reescribe lo que edites." : "Only the fields you edit get rewritten."} onReset={pending.text ? () => setText(initial) : undefined} es={es} />
            <TextFields layout={layout} value={text} onChange={setText} />
          </div>
        )}

        {tab === "colors" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Nuevos colores" : "New colors"} hint={es ? "Luces, fondo, título y efectos se recolorean." : "Lighting, background, title and effects get recoloured."} onReset={colors ? () => setColors(null) : undefined} es={es} />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {PALETTES.map(([name, c1, c2, dark]) => {
                const on = colors?.c1 === c1 && colors?.c2 === c2;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => setColors(on ? null : { c1, c2 })}
                    className={`relative h-12 rounded-xl border-2 transition ${on ? "scale-105 border-white shadow-[0_0_18px_-4px_rgba(255,255,255,0.8)]" : "border-line hover:border-muted"}`}
                    style={{ background: `linear-gradient(135deg, ${c1} 0 45%, ${c2} 45% 75%, ${dark} 75%)` }}
                  >
                    {on && <span className="absolute inset-0 grid place-items-center text-lg drop-shadow">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "background" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Nuevo fondo" : "New background"} hint={es ? "El jugador, el texto y el estilo se quedan." : "The player, text and style stay."} onReset={scene ? () => setScene("") : undefined} es={es} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BG_SCENES.map((b) => {
                const on = scene === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setScene(on ? "" : b.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${on ? "border-lime bg-lime/10 text-lime" : "border-line bg-panel-2 hover:border-muted"}`}
                  >
                    <span className="text-lg">{b.icon}</span> {es ? b.es : b.en}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "photo" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Otra foto del jugador" : "Another player photo"} hint={es ? "La IA rehace el recorte con la foto nueva." : "The AI redoes the cut-out with the new photo."} onReset={photo ? () => setPhoto(null) : undefined} es={es} />
            <ImageDrop kind="photo" label={es ? "🧍 Nueva foto" : "🧍 New photo"} value={photo} onChange={setPhoto} searchQuery={initial.name} />
          </div>
        )}

        {tab === "logo" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Otro logo del equipo" : "Another team logo"} hint={es ? "Se coloca tal cual, sin redibujar." : "Placed exactly as uploaded, never redrawn."} onReset={logo ? () => setLogo(null) : undefined} es={es} />
            <ImageDrop kind="logo" label={es ? "🛡️ Nuevo logo" : "🛡️ New logo"} value={logo} onChange={setLogo} searchQuery={initial.team} />
          </div>
        )}

        {tab === "other" && (
          <div className="space-y-3">
            <PanelHead title={es ? "Dile a la IA qué cambiar" : "Tell the AI what to change"} hint={es ? "Toca un arreglo rápido o escribe el tuyo." : "Tap a quick fix or write your own."} onReset={note ? () => setNote("") : undefined} es={es} />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FIXES.map((f) => (
                <button key={f.en} type="button" onClick={() => addFix(es ? f.es : f.en)} className="rounded-full border border-line bg-panel-2 px-3 py-1.5 text-xs font-semibold transition hover:border-lime/60 hover:text-lime">
                  {f.icon} {es ? f.es : f.en}
                </button>
              ))}
            </div>
            <textarea
              className="input min-h-24"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={es ? "ej. Haz el título más grande, quita el humo de la izquierda, el jugador más nítido" : "e.g. Make the title bigger, remove the smoke on the left, sharper player"}
            />
          </div>
        )}
      </div>

      {/* Summary + apply */}
      <div className="border-t border-line p-4 sm:p-5">
        {summary.length > 0 ? (
          <p className="mb-2 text-xs text-muted">
            <span className="font-bold text-white/80">{es ? "Cambiando:" : "Changing:"}</span> {summary.join(" · ")}
          </p>
        ) : (
          <p className="mb-2 text-xs text-muted">{es ? "Elige una pestaña y cambia algo — todo lo demás se queda igual." : "Pick a tab and change something — everything else stays the same."}</p>
        )}
        {credits >= cost ? (
          <button type="button" className="btn-primary w-full py-3 disabled:opacity-50" disabled={!ready} onClick={apply}>
            ✨ {es ? "Aplicar cambios" : "Apply changes"} · {cost} {es ? "créditos" : "credits"}
          </button>
        ) : (
          <Link href="/pricing" className="btn-ghost w-full">
            {es ? "Comprar créditos" : "Get credits"}
          </Link>
        )}
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </div>
    </section>
  );
}

function PanelHead({ title, hint, onReset, es }: { title: string; hint: string; onReset?: () => void; es: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-bold">{title}</div>
        <div className="text-[11px] text-muted">{hint}</div>
      </div>
      {onReset && (
        <button type="button" onClick={onReset} className="shrink-0 text-xs font-bold text-muted hover:text-white">
          ↺ {es ? "Deshacer" : "Reset"}
        </button>
      )}
    </div>
  );
}

const QUICK_FIXES: { icon: string; en: string; es: string }[] = [
  { icon: "🔠", en: "Make the name bigger", es: "Haz el nombre más grande" },
  { icon: "✅", en: "Fix the spelling of the text", es: "Corrige la ortografía del texto" },
  { icon: "🧹", en: "Remove any extra words", es: "Quita cualquier palabra extra" },
  { icon: "🧑", en: "Make the face more realistic", es: "Haz la cara más realista" },
  { icon: "☀️", en: "Brighter and more contrast", es: "Más brillo y contraste" },
  { icon: "🌫️", en: "Calmer, less busy background", es: "Fondo más calmado, menos cargado" },
  { icon: "🏃", en: "A different pose for the player", es: "Otra pose para el jugador" },
  { icon: "🛡️", en: "Make the crest bigger", es: "Haz el escudo más grande" },
];
