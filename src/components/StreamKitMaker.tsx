"use client";
import { useEffect, useRef, useState } from "react";
import { ImageDrop } from "./ImageDrop";
import { isPhone } from "@/lib/is-phone";

type Piece = "promo" | "starting" | "brb" | "ending" | "camframe" | "overlay";
type Vibe = "neon" | "esports" | "fire" | "ice" | "anime" | "luxury" | "minimal" | "retro";
type Item = { kind: Piece; status: "queued" | "making" | "ready" | "failed"; url?: string };
type Kit = { id: string; status: string; items: Item[]; inputs: { name: string } };

const PIECES: { id: Piece; en: string; es: string; icon: string; subEn: string; subEs: string }[] = [
  { id: "promo", en: "Going LIVE promo", es: "Promo de directo", icon: "📣", subEn: "post it before you go live", subEs: "publícalo antes del directo" },
  { id: "starting", en: "Starting soon", es: "Empezamos pronto", icon: "⏳", subEn: "screen before the stream", subEs: "pantalla antes del directo" },
  { id: "brb", en: "Be right back", es: "Vuelvo enseguida", icon: "☕", subEn: "screen for breaks", subEs: "pantalla de pausa" },
  { id: "ending", en: "Stream ending", es: "Fin del directo", icon: "👋", subEn: "thanks for watching", subEs: "gracias por ver" },
  { id: "camframe", en: "Cam frame overlay", es: "Marco de cámara", icon: "🎥", subEn: "transparent PNG", subEs: "PNG transparente" },
  { id: "overlay", en: "Full LIVE overlay", es: "Overlay completo", icon: "🖼️", subEn: "transparent PNG, top + bottom bars", subEs: "PNG transparente, barras arriba y abajo" },
];
const VIBES: { id: Vibe; en: string; es: string; icon: string }[] = [
  { id: "neon", en: "Neon gamer", es: "Neón gamer", icon: "🌌" },
  { id: "esports", en: "Esports pro", es: "Esports pro", icon: "🎮" },
  { id: "fire", en: "Fire", es: "Fuego", icon: "🔥" },
  { id: "ice", en: "Ice", es: "Hielo", icon: "❄️" },
  { id: "anime", en: "Anime", es: "Anime", icon: "⚡" },
  { id: "luxury", en: "Luxury gold", es: "Lujo dorado", icon: "👑" },
  { id: "minimal", en: "Clean minimal", es: "Minimal", icon: "◻️" },
  { id: "retro", en: "Retro arcade", es: "Arcade retro", icon: "🕹️" },
];

export function StreamKitMaker({ es, perPiece, credits, initialKit }: { es: boolean; perPiece: number; credits: number; initialKit: string }) {
  const [f, setF] = useState({ name: "", content: "", vibe: "neon" as Vibe, colors: "", socials: "", schedule: "" });
  const [pieces, setPieces] = useState<Piece[]>(["promo", "starting", "brb", "ending", "camframe", "overlay"]);
  const [logo, setLogo] = useState<string | null>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cost = perPiece * pieces.length;
  const label = (k: Piece) => PIECES.find((p) => p.id === k)!;

  async function load(id: string) {
    const r = await fetch(`/api/stream-kits/${id}`, { cache: "no-store" });
    if (!r.ok) return;
    const { kit: k } = (await r.json()) as { kit: Kit };
    setKit(k);
    if (k.status === "PROCESSING") timer.current = setTimeout(() => load(id), 4000);
  }
  useEffect(() => {
    if (initialKit) load(initialKit);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!pieces.length) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/stream-kits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, logoUrl: logo ?? "", pieces }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error === "err_credits" ? (es ? "No tienes suficientes créditos." : "Not enough credits.") : d.error === "err_blocked" ? (es ? "Esa palabra no está permitida." : "That word isn't allowed.") : es ? "No se pudo empezar. Inténtalo otra vez." : "Couldn't start. Try again.");
        return;
      }
      setKit(d.kit);
      window.history.replaceState(null, "", `/stream?kit=${d.kit.id}`);
      timer.current = setTimeout(() => load(d.kit.id), 5000);
    } finally {
      setBusy(false);
    }
  }

  async function save(url: string, file: string) {
    try {
      const blob = await (await fetch(url)).blob();
      const fileObj = new File([blob], file, { type: "image/png" });
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

  // ---------- the kit ----------
  if (kit) {
    const slug = (kit.inputs.name || "stream").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const done = kit.items.filter((x) => x.status === "ready").length;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-4xl">{es ? "Tu kit de streamer" : "Your streamer kit"} 🎥</h1>
          <p className="text-sm text-muted">
            {kit.status === "PROCESSING"
              ? es ? `Diseñando el kit de ${kit.inputs.name}… (${done}/${kit.items.length}) — tarda 2–4 minutos.` : `Designing ${kit.inputs.name}'s kit… (${done}/${kit.items.length}) — takes 2–4 minutes.`
              : es ? "¡Listo! Todo en 1080×1920 (vertical, para TikTok LIVE). Los overlays son PNG transparentes." : "Ready! Everything is 1080×1920 (vertical, for TikTok LIVE). The overlays are transparent PNGs."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kit.items.map((it) => {
            const p = label(it.kind);
            const overlay = it.kind === "camframe" || it.kind === "overlay";
            return (
              <div key={it.kind} className="card overflow-hidden p-0">
                <div className={`relative aspect-[9/16] w-full ${overlay ? "bg-[conic-gradient(#1c1c22_25%,#2a2a32_0_50%,#1c1c22_0_75%,#2a2a32_0)] bg-[length:20px_20px]" : "bg-panel-2"}`}>
                  {it.status === "ready" && it.url ? (
                    <img src={it.url} alt={p.en} className="h-full w-full object-cover" />
                  ) : it.status === "failed" ? (
                    <div className="grid h-full place-items-center p-3 text-center text-xs text-danger">❌ {es ? "No salió — crédito devuelto" : "Didn't work — credit refunded"}</div>
                  ) : (
                    <div className="grid h-full animate-pulse place-items-center text-3xl">{p.icon}</div>
                  )}
                </div>
                <div className="space-y-1.5 p-2.5">
                  <p className="truncate text-sm font-bold">{p.icon} {es ? p.es : p.en}</p>
                  {it.status === "ready" && it.url && (
                    <button className="btn-primary w-full !py-1.5 text-xs" onClick={() => save(it.url!, `${slug}-${it.kind}.png`)}>⬇️ {es ? "Descargar PNG" : "Download PNG"}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {kit.status !== "PROCESSING" && (
          <div className="card space-y-1.5 p-4 text-sm text-muted">
            <p className="font-bold text-white">📱 {es ? "Cómo usarlo en TikTok LIVE" : "How to use it on TikTok LIVE"}</p>
            <p>{es ? "• Promo: publícalo como post o historia antes de entrar en directo." : "• Promo: post it (or as a story) before you go live."}</p>
            <p>{es ? "• Empezamos pronto / Vuelvo enseguida / Fin: en TikTok LIVE Studio añade una fuente de Imagen y cámbiala según el momento." : "• Starting soon / BRB / Ending: in TikTok LIVE Studio add an Image source and switch between them."}</p>
            <p>{es ? "• Overlays: añádelos como Imagen encima de tu cámara o juego — el centro es transparente." : "• Overlays: add them as an Image on top of your camera or game — the centre is transparent."}</p>
          </div>
        )}
        <button className="btn-ghost" onClick={() => { setKit(null); window.history.replaceState(null, "", "/stream"); }}>✨ {es ? "Hacer otro kit" : "Make another kit"}</button>
      </div>
    );
  }

  // ---------- the form ----------
  return (
    <form onSubmit={generate} className="space-y-5">
      <div>
        <h1 className="font-display text-4xl">{es ? "Kit de streamer" : "Streamer kit"} 🎥</h1>
        <p className="text-sm text-muted">{es ? "Banners y overlays profesionales para TikTok LIVE — todo a juego, en vertical 1080×1920." : "Professional banners and overlays for TikTok LIVE — all matching, vertical 1080×1920."}</p>
      </div>
      <div className="card space-y-4 p-5">
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Tu nombre de streamer" : "Your streamer name"}</span>
          <input className="input mt-1" required maxLength={30} placeholder="@KIXOGAMER" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Qué transmites (opcional)" : "What you stream (optional)"}</span>
          <input className="input mt-1" maxLength={80} placeholder={es ? "Ej. FC 26 Pro Clubs, Fortnite, música…" : "e.g. FC 26 Pro Clubs, Fortnite, music…"} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
        </label>
        <div>
          <span className="text-sm font-semibold">{es ? "Estilo" : "Vibe"}</span>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VIBES.map((v) => (
              <button key={v.id} type="button" onClick={() => setF({ ...f, vibe: v.id })} className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${f.vibe === v.id ? "border-lime bg-lime/10" : "border-line"}`}>
                {v.icon} {es ? v.es : v.en}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Colores (opcional)" : "Colours (optional)"}</span>
          <input className="input mt-1" maxLength={100} placeholder={es ? "Ej. morado y verde neón" : "e.g. purple and neon green"} value={f.colors} onChange={(e) => setF({ ...f, colors: e.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">{es ? "Redes (opcional)" : "Socials (optional)"}</span>
            <input className="input mt-1" maxLength={60} placeholder="IG @kixogamer · YT kixo" value={f.socials} onChange={(e) => setF({ ...f, socials: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">{es ? "Horario (opcional)" : "Schedule (optional)"}</span>
            <input className="input mt-1" maxLength={40} placeholder={es ? "Lun–Vie 8 PM" : "Mon–Fri 8 PM"} value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })} />
          </label>
        </div>
        <ImageDrop kind="logo" noSearch value={logo} onChange={setLogo} label={es ? "Tu logo (opcional)" : "Your logo (optional)"} />
        <div>
          <span className="text-sm font-semibold">{es ? "Piezas del kit" : "Kit pieces"}</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PIECES.map((p) => {
              const on = pieces.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setPieces((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))} className={`rounded-xl border px-3 py-2 text-left ${on ? "border-lime bg-lime/10" : "border-line"}`}>
                  <span className="block text-sm font-bold">{on ? "✅" : "⬜"} {p.icon} {es ? p.es : p.en}</span>
                  <span className="block text-[11px] text-muted">{es ? p.subEs : p.subEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <button className="btn-primary w-full py-4 text-lg" disabled={busy || !pieces.length || (cost > 0 && credits < cost)}>
        {busy ? "…" : `✨ ${es ? "Crear mi kit" : "Make my kit"} · ${pieces.length} ${es ? "piezas" : "pieces"}${cost > 0 ? ` · ${cost} ${es ? "créditos" : "credits"}` : ""}`}
      </button>
      {cost > 0 && credits < cost && <p className="text-center text-sm text-muted">{es ? "No tienes suficientes créditos." : "You don't have enough credits."} <a className="underline" href="/credits">{es ? "Comprar créditos" : "Get credits"}</a></p>}
    </form>
  );
}
