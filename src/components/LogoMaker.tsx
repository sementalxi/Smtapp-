"use client";
import { useEffect, useRef, useState } from "react";
import { ImageDrop } from "./ImageDrop";
import { isPhone } from "@/lib/is-phone";

type Style = "mix" | "mascot" | "shield" | "monogram" | "minimal" | "beast";
type PubSet = { id: string; status: string; previews: (string | null)[]; picked: number; pickedUrl: string; pngUrl: string; failed: boolean; inputs: { name: string } };

const STYLES: { id: Style; en: string; es: string; icon: string }[] = [
  { id: "mix", en: "Mix — 5 different looks", es: "Mezcla — 5 estilos distintos", icon: "🎲" },
  { id: "mascot", en: "Esports mascot", es: "Mascota esports", icon: "🐺" },
  { id: "beast", en: "Aggressive beast", es: "Bestia agresiva", icon: "🔥" },
  { id: "shield", en: "Club crest", es: "Escudo de club", icon: "🛡️" },
  { id: "monogram", en: "Lettermark", es: "Monograma", icon: "🔠" },
  { id: "minimal", en: "Modern minimal", es: "Moderno minimal", icon: "◼️" },
];

export function LogoMaker({ es, cost, credits, initialSet }: { es: boolean; cost: number; credits: number; initialSet: string }) {
  const [f, setF] = useState({ name: "", idea: "", colors: "", style: "mix" as Style });
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [set, setSet] = useState<PubSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(id: string) {
    const r = await fetch(`/api/logo-sets/${id}`, { cache: "no-store" });
    if (!r.ok) return;
    const { set: s } = (await r.json()) as { set: PubSet };
    setSet(s);
    if (s.status === "PROCESSING") timer.current = setTimeout(() => load(id), 3000);
  }
  useEffect(() => {
    if (initialSet) load(initialSet);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/logo-sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, refUrl: refUrl ?? "" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error === "err_credits" ? (es ? "No tienes suficientes créditos." : "Not enough credits.") : d.error === "err_blocked" ? (es ? "Esa palabra no está permitida." : "That word isn't allowed.") : es ? "No se pudo empezar. Inténtalo otra vez." : "Couldn't start. Try again.");
        return;
      }
      setSet(d.set);
      window.history.replaceState(null, "", `/logo?set=${d.set.id}`);
      timer.current = setTimeout(() => load(d.set.id), 4000);
    } finally {
      setBusy(false);
    }
  }

  async function pick(n: number) {
    if (!set) return;
    if (!window.confirm(es ? "¿Elegir este logo? Solo puedes desbloquear uno de los 5." : "Pick this logo? You can unlock only one of the 5.")) return;
    setPicking(true);
    try {
      const r = await fetch(`/api/logo-sets/${set.id}/pick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index: n }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.set) {
        setSet(d.set);
        setZoom(null);
      } else setErr(es ? "No se pudo desbloquear. Inténtalo otra vez." : "Couldn't unlock it. Try again.");
    } finally {
      setPicking(false);
    }
  }

  async function save(url: string, file: string) {
    try {
      const blob = await (await fetch(url)).blob();
      const fileObj = new File([blob], file, { type: blob.type || "image/png" });
      if (isPhone() && navigator.canShare?.({ files: [fileObj] })) {
        await navigator.share({ files: [fileObj], title: file });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") window.open(url, "_blank");
    }
  }

  const ready = set?.previews.filter(Boolean).length ?? 0;
  const noGrab = { onContextMenu: (e: React.MouseEvent) => e.preventDefault(), draggable: false };

  // ---------- the picked logo ----------
  if (set && set.picked >= 0) {
    const slug = (set.inputs.name || "logo").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return (
      <div className="space-y-5">
        <h1 className="font-display text-4xl">{es ? "¡Tu logo está listo!" : "Your logo is ready!"} 🔥</h1>
        <div className="card overflow-hidden p-0">
          <img src={set.pngUrl || set.pickedUrl} alt={set.inputs.name} className="mx-auto w-full max-w-lg bg-[conic-gradient(#222_25%,#2c2c2c_0_50%,#222_0_75%,#2c2c2c_0)] bg-[length:24px_24px]" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {set.pngUrl && <button className="btn-primary py-3.5" onClick={() => save(set.pngUrl, `${slug}-transparent.png`)}>⬇️ {es ? "PNG sin fondo" : "Transparent PNG"}</button>}
          <button className={set.pngUrl ? "btn-ghost py-3.5" : "btn-primary py-3.5"} onClick={() => save(set.pickedUrl, `${slug}.png`)}>⬇️ {es ? "Con fondo oscuro" : "With dark background"}</button>
        </div>
        <p className="text-sm text-muted">{es ? "También está guardado en Mis pósters. Úsalo como escudo de tu equipo en cualquier póster." : "It's also saved in My posters. Use it as your team crest on any poster."}</p>
        <button className="btn-ghost" onClick={() => { setSet(null); window.history.replaceState(null, "", "/logo"); }}>✨ {es ? "Hacer otro logo" : "Make another logo"}</button>
      </div>
    );
  }

  // ---------- generating / picking ----------
  if (set) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-4xl">{es ? "Elige tu logo" : "Pick your logo"}</h1>
          <p className="text-sm text-muted">
            {set.status === "PROCESSING"
              ? es ? `Diseñando 5 opciones para ${set.inputs.name}… (${ready}/5) — tarda 1–2 minutos.` : `Designing 5 options for ${set.inputs.name}… (${ready}/5) — takes 1–2 minutes.`
              : set.failed
                ? es ? "No se pudo crear esta vez. Tus créditos fueron devueltos." : "It couldn't be made this time. Your credits were refunded."
                : es ? "Son vistas previas con marca de agua. Elige una para desbloquear el logo completo en alta calidad." : "These are watermarked previews. Pick one to unlock the full logo in high quality."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {set.previews.map((p, n) => (
            <button key={n} type="button" disabled={!p} onClick={() => p && setZoom(n)} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-panel-2 select-none" {...noGrab}>
              {p ? (
                <img src={p} alt={`Option ${n + 1}`} className="pointer-events-none h-full w-full select-none object-cover" {...noGrab} />
              ) : set.status === "PROCESSING" ? (
                <div className="grid h-full w-full animate-pulse place-items-center text-3xl">🎨</div>
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-muted">—</div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold">{n + 1}</span>
            </button>
          ))}
        </div>
        {err && <p className="text-sm text-red-300">{err}</p>}
        {set.failed && <button className="btn-primary" onClick={() => setSet(null)}>{es ? "Probar otra vez" : "Try again"}</button>}
        {zoom !== null && set.previews[zoom] && (
          <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-black/90 p-4" onClick={() => !picking && setZoom(null)} {...noGrab}>
            <img src={set.previews[zoom]!} alt="" className="pointer-events-none max-h-[70vh] w-full max-w-md select-none rounded-2xl" {...noGrab} />
            <div className="flex w-full max-w-md gap-2" onClick={(e) => e.stopPropagation()}>
              <button className="btn-primary flex-1 py-3.5" disabled={picking} onClick={() => pick(zoom)}>{picking ? "…" : `✅ ${es ? "Elegir este" : "Pick this one"}`}</button>
              <button className="btn-ghost py-3.5" disabled={picking} onClick={() => setZoom(null)}>{es ? "Cerrar" : "Close"}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- the form ----------
  return (
    <form onSubmit={generate} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{es ? "Creador de logos" : "Logo maker"} 🛡️</h1>
        <p className="text-sm text-muted">{es ? "KIXO diseña 5 logos originales. Ves las 5 opciones como vista previa y desbloqueas la que más te guste." : "KIXO designs 5 original logos. You see all 5 as previews and unlock the one you like best."}</p>
      </div>
      <div className="card space-y-4 p-5">
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Nombre del equipo (solo el nombre)" : "Team name (just the name)"}</span>
          <input className="input mt-1" required maxLength={40} placeholder="SACREDZ X" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Idea o mascota (opcional)" : "Idea or mascot (optional)"}</span>
          <input className="input mt-1" maxLength={300} placeholder={es ? "Ej. un lobo samurái con ojos rojos" : "e.g. a samurai wolf with red eyes"} value={f.idea} onChange={(e) => setF({ ...f, idea: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Colores (opcional)" : "Colours (optional)"}</span>
          <input className="input mt-1" maxLength={120} placeholder={es ? "Ej. rojo, negro y blanco" : "e.g. red, black and white"} value={f.colors} onChange={(e) => setF({ ...f, colors: e.target.value })} />
        </label>
        <div>
          <span className="text-sm font-semibold">{es ? "Estilo" : "Style"}</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STYLES.map((s) => (
              <button key={s.id} type="button" onClick={() => setF({ ...f, style: s.id })} className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${f.style === s.id ? "border-lime bg-lime/10" : "border-line"}`}>
                {s.icon} {es ? s.es : s.en}
              </button>
            ))}
          </div>
        </div>
        <ImageDrop kind="logo" noSearch value={refUrl} onChange={setRefUrl} label={es ? "Inspiración (opcional): sube un logo parecido a lo que quieres" : "Inspiration (optional): upload a logo similar to what you want"} hint={es ? "KIXO copia el estilo y la energía, pero crea un logo nuevo y original con tu nombre." : "KIXO matches the style and energy, but makes a new, original logo with your name."} />
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <button className="btn-primary w-full py-4 text-lg" disabled={busy || (cost > 0 && credits < cost)}>
        {busy ? "…" : `✨ ${es ? "Crear 5 logos" : "Make 5 logos"}${cost > 0 ? ` · ${cost} ${es ? "créditos" : "credits"}` : ""}`}
      </button>
      {cost > 0 && credits < cost && <p className="text-center text-sm text-muted">{es ? "No tienes suficientes créditos." : "You don't have enough credits."} <a className="underline" href="/credits">{es ? "Comprar créditos" : "Get credits"}</a></p>}
    </form>
  );
}
