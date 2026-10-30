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
  const [parts, setParts] = useState<Part[]>([]);
  const [text, setText] = useState(initial);
  const [colors, setColors] = useState<{ c1: string; c2?: string } | null>(null);
  const [scene, setScene] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const PARTS: { id: Part; icon: string; en: string; es: string }[] = [
    { id: "text", icon: "🔤", en: "Text", es: "Texto" },
    { id: "colors", icon: "🎨", en: "Colors", es: "Colores" },
    { id: "background", icon: "🌆", en: "Background", es: "Fondo" },
    { id: "photo", icon: "🧍", en: "Photo", es: "Foto" },
    { id: "logo", icon: "🛡️", en: "Logo", es: "Logo" },
    { id: "other", icon: "✍️", en: "Something else", es: "Otra cosa" },
  ];
  const toggle = (p: Part) => setParts((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const has = (p: Part) => parts.includes(p);

  const changedText = Object.fromEntries(
    Object.entries(text).filter(([k, v]) => typeof v === "string" && v !== (initial as unknown as Record<string, unknown>)[k] && k !== "extraPrompt"),
  ) as Record<string, string>;
  const ready =
    (has("text") && Object.keys(changedText).length > 0) ||
    (has("colors") && !!colors) ||
    (has("background") && !!scene) ||
    (has("photo") && !!photo) ||
    (has("logo") && !!logo) ||
    (has("other") && note.trim().length > 2);

  async function apply() {
    setBusy(true);
    onBusy?.(true);
    setErr("");
    const res = await fetch(`/api/banners/${id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(has("text") ? { text: changedText } : {}),
        ...(has("colors") && colors ? { colors } : {}),
        ...(has("background") && scene ? { scene } : {}),
        ...(has("photo") && photo ? { photoUrl: photo } : {}),
        ...(has("logo") && logo ? { logoUrl: logo } : {}),
        ...(has("other") && note.trim() ? { note: note.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      const w = await waitForBanner(data.id);
      if (w.ok) {
        router.push(`/banner/${data.id}`);
        return;
      }
      setErr(
        w.error === "err_credits"
          ? es ? "No tienes créditos suficientes." : "You don't have enough credits."
          : w.error === "err_blocked" || w.error === "err_photo_blocked"
            ? es ? "El filtro de seguridad de la IA bloqueó este cambio (créditos devueltos)." : "The AI's safety filter blocked this change (credits refunded)."
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
          <GenerationProgress photo={imageUrl} expectedSeconds={100} />
        </div>
      </section>
    );
  }

  return (
    <section className="card space-y-4 border-lime/30 p-5">
      <div>
        <h2 className="text-lg font-extrabold">✏️ {es ? "Editar este diseño" : "Edit this design"}</h2>
        <p className="text-xs text-muted">
          {es
            ? "Toca lo que quieres cambiar. La IA edita este mismo póster y deja todo lo demás igual. Se guarda como una versión nueva — el original no se pierde."
            : "Tap what you want to change. The AI edits this same poster and keeps everything else the same. It's saved as a new version — the original stays."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={`rounded-xl border px-2 py-3 text-center text-sm font-bold transition ${has(p.id) ? "border-lime bg-lime/10 text-lime" : "border-line bg-panel-2 hover:border-muted"}`}
          >
            <span className="block text-xl">{p.icon}</span>
            {es ? p.es : p.en}
          </button>
        ))}
      </div>

      {has("text") && (
        <div className="space-y-3 rounded-xl border border-line p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">🔤 {es ? "Texto" : "Text"}</div>
          <TextFields layout={layout} value={text} onChange={setText} />
        </div>
      )}

      {has("colors") && (
        <div className="space-y-2 rounded-xl border border-line p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">🎨 {es ? "Nuevos colores" : "New colors"}</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {PALETTES.map(([name, c1, c2, dark]) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => setColors({ c1, c2 })}
                className={`h-11 rounded-lg border-2 ${colors?.c1 === c1 && colors?.c2 === c2 ? "border-white" : "border-line"}`}
                style={{ background: `linear-gradient(135deg, ${c1} 0 45%, ${c2} 45% 75%, ${dark} 75%)` }}
              />
            ))}
          </div>
        </div>
      )}

      {has("background") && (
        <div className="space-y-2 rounded-xl border border-line p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">🌆 {es ? "Nuevo fondo" : "New background"}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BG_SCENES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setScene(b.id)}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm ${scene === b.id ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`}
              >
                {b.icon} {es ? b.es : b.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {has("photo") && (
        <div className="rounded-xl border border-line p-4">
          <ImageDrop kind="photo" label={es ? "🧍 Nueva foto del jugador" : "🧍 New player photo"} value={photo} onChange={setPhoto} searchQuery={initial.name} />
        </div>
      )}

      {has("logo") && (
        <div className="rounded-xl border border-line p-4">
          <ImageDrop kind="logo" label={es ? "🛡️ Nuevo logo del equipo" : "🛡️ New team logo"} value={logo} onChange={setLogo} searchQuery={initial.team} />
        </div>
      )}

      {has("other") && (
        <div className="space-y-2 rounded-xl border border-line p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">✍️ {es ? "¿Qué quieres cambiar?" : "What should change?"}</div>
          <textarea
            className="input min-h-20"
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={es ? "ej. Haz el título más grande y rojo, quita el humo de la izquierda" : "e.g. Make the title bigger and red, remove the smoke on the left"}
          />
        </div>
      )}

      {parts.length > 0 && (
        <div>
          {credits >= cost ? (
            <button type="button" className="btn-primary w-full py-3" disabled={!ready} onClick={apply}>
              ✨ {es ? "Aplicar cambios" : "Apply changes"} · {cost} {es ? "créditos" : "credits"}
            </button>
          ) : (
            <Link href="/pricing" className="btn-ghost w-full">
              {es ? "Comprar créditos" : "Get credits"}
            </Link>
          )}
          {!ready && <p className="mt-1 text-center text-xs text-muted">{es ? "Completa lo que elegiste arriba." : "Fill in what you picked above."}</p>}
        </div>
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
    </section>
  );
}
