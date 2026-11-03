"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { shrink } from "./ImageDrop";

type Msg = { id: string; from: "me" | "staff" | "system"; name: string; avatar?: string; text: string; images: string[]; at: string };

/** Opens support from anywhere: window.dispatchEvent(new Event("kixo:support")). */
export const openSupport = () => window.dispatchEvent(new Event("kixo:support"));

/** Live support pop-up. Messages go to a private ticket channel in the Discord server; staff replies show up here. */
export function SupportChat() {
  const { locale } = useT();
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasTicket, setHasTicket] = useState(false);
  const [closed, setClosed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unread, setUnread] = useState(0);
  const [topic, setTopic] = useState<"" | "support" | "custom">("");
  const seen = useRef<number>(0);
  const box = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/support", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return;
    setEnabled(d.enabled !== false);
    setHasTicket(!!d.ticket);
    if (d.closed) setClosed(true);
    if (Array.isArray(d.messages)) setMsgs(d.messages);
  }, []);

  // On page load: is there an open ticket? (shows the 💬 bubble in the corner)
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = () => { setOpen(true); setClosed(false); load(); };
    window.addEventListener("kixo:support", h);
    if (new URLSearchParams(location.search).get("support") === "1") h();
    return () => window.removeEventListener("kixo:support", h);
  }, [load]);

  // Live: poll every 4s while open (every 30s in the background when a ticket is open, for the unread badge).
  useEffect(() => {
    if (!open && !hasTicket) return;
    const t = setInterval(load, open ? 4000 : 30000);
    return () => clearInterval(t);
  }, [open, hasTicket, load]);

  useEffect(() => {
    const staff = msgs.filter((m) => m.from === "staff").length;
    if (open) { seen.current = staff; setUnread(0); } else setUnread(Math.max(0, staff - seen.current));
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(imageUrl?: string) {
    const t = text.trim();
    if ((!t && !imageUrl) || busy) return;
    setBusy(true);
    setErr("");
    setClosed(false);
    const tmp: Msg = { id: `tmp-${Date.now()}`, from: "me", name: "", text: t, images: imageUrl ? [imageUrl] : [], at: new Date().toISOString() };
    setMsgs((m) => [...m, tmp]);
    setText("");
    const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, imageUrl, topic: topic || "support" }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsgs((m) => m.filter((x) => x.id !== tmp.id));
      setText(t);
      setErr(d.error === "support_off" ? (es ? "El soporte no está disponible ahora." : "Support isn't available right now.") : es ? "No se pudo enviar. Intenta de nuevo." : "Couldn't send. Try again.");
      return;
    }
    setHasTicket(true);
    load();
  }

  async function attach(f: File) {
    if (!/^image\/(png|jpe?g|webp|heic|heif)$/i.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", await shrink(f), f.name);
    fd.append("kind", "photo");
    const d = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (d.url) send(d.url);
    else setErr(es ? "No se pudo subir la imagen." : "Couldn't upload the picture.");
  }

  async function closeIt() {
    await fetch("/api/support/close", { method: "POST" }).catch(() => {});
    setHasTicket(false);
    setClosed(true);
    setTopic("");
  }

  const time = (s: string) => new Date(s).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      {!open && (hasTicket || unread > 0) && (
        <button
          type="button"
          aria-label={es ? "Abrir chat de soporte" : "Open support chat"}
          onClick={() => { setOpen(true); load(); }}
          className="kixo-float fixed bottom-5 right-4 z-[60] grid h-14 w-14 place-items-center rounded-full bg-[#5865F2] text-2xl shadow-[0_10px_30px_-6px_rgba(88,101,242,0.9)] ring-2 ring-white/20 transition hover:scale-110"
        >
          💬
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-lime px-1 text-xs font-black text-ink ring-2 ring-ink">{unread}</span>
          )}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="flex h-[85svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-panel shadow-2xl sm:h-[640px] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-lime/15 to-transparent px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#5865F2] text-lg">💬</span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold">{es ? "Soporte KIXO" : "KIXO Support"}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> {es ? "Chat en vivo con el equipo" : "Live chat with the team"}
                </div>
              </div>
              {hasTicket && (
                <button type="button" onClick={closeIt} className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-white">
                  {es ? "Cerrar ticket" : "Close ticket"}
                </button>
              )}
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:text-white">✕</button>
            </div>

            <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-line bg-panel-2 p-3 text-sm text-white/85">
                👋 {es ? "¡Hola! Escríbenos tu pregunta o problema y un miembro del equipo te responde aquí mismo." : "Hi! Tell us your question or problem and a team member will reply right here."}
              </div>
              {enabled && !hasTicket && !topic && (
                <div className="grid gap-2">
                  {([
                    ["support", "🛟", es ? "Soporte" : "Support", es ? "Ayuda con tu cuenta, créditos, pagos o un póster." : "Help with your account, credits, payments or a poster."],
                    ["custom", "🎨", es ? "Banner personalizado" : "Custom banner", es ? "Pide un diseño hecho a mano por nuestro equipo." : "Order a design made by hand by our team."],
                  ] as const).map(([k, icon, title, desc]) => (
                    <button key={k} type="button" onClick={() => setTopic(k)} className="flex items-center gap-3 rounded-2xl border border-line bg-panel-2 p-3 text-left transition hover:border-lime/60 active:scale-[0.99]">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-2xl">{icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-extrabold">{title}</span>
                        <span className="block text-xs text-muted">{desc}</span>
                      </span>
                      <span className="text-lime">›</span>
                    </button>
                  ))}
                </div>
              )}
              {enabled && !hasTicket && topic && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-lime/40 bg-lime/10 px-3 py-2 text-sm">
                  <span>
                    {topic === "custom"
                      ? es ? "🎨 Banner personalizado — cuéntanos qué quieres (tipo, nombres, colores) y adjunta fotos/logos con 📎." : "🎨 Custom banner — tell us what you want (type, names, colors) and attach photos/logos with 📎."
                      : es ? "🛟 Soporte — escribe tu pregunta o problema." : "🛟 Support — type your question or problem."}
                  </span>
                  {msgs.length === 0 && <button type="button" onClick={() => setTopic("")} className="shrink-0 text-xs font-bold text-muted hover:text-white">{es ? "Cambiar" : "Change"}</button>}
                </div>
              )}
              {!enabled && <p className="text-center text-sm text-muted">{es ? "El soporte no está disponible ahora." : "Support isn't available right now."}</p>}
              {msgs.map((m) =>
                m.from === "system" ? (
                  <div key={m.id} className="text-center text-[11px] font-bold uppercase tracking-wider text-muted">🔒 {es ? "Ticket cerrado" : "Ticket closed"}</div>
                ) : (
                  <div key={m.id} className={`flex items-end gap-2 ${m.from === "me" ? "justify-end" : ""}`}>
                    {m.from === "staff" &&
                      (m.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar} alt="" className="h-7 w-7 rounded-full" />
                      ) : (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#5865F2] text-xs font-bold">{m.name[0]}</span>
                      ))}
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "rounded-br-sm bg-lime text-ink" : "rounded-bl-sm border border-line bg-panel-2"}`}>
                      {m.from === "staff" && <div className="mb-0.5 text-[11px] font-bold text-teal">{m.name} · {es ? "Equipo" : "Team"}</div>}
                      {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                      {m.images.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="" className="mt-1.5 max-h-56 rounded-lg" />
                      ))}
                      <div className={`mt-0.5 text-right text-[10px] ${m.from === "me" ? "text-ink/60" : "text-muted"}`}>{time(m.at)}</div>
                    </div>
                  </div>
                ),
              )}
              {closed && !hasTicket && (
                <p className="text-center text-xs text-muted">{es ? "Este ticket está cerrado. Escribe de nuevo para abrir uno nuevo." : "This ticket is closed. Write again to open a new one."}</p>
              )}
            </div>

            {err && <p className="px-4 pb-1 text-xs text-danger">{err}</p>}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ""; }} />
              <button type="button" aria-label="Attach picture" disabled={busy || !enabled || (!hasTicket && !topic)} onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-lg text-muted hover:text-white">📎</button>
              <textarea
                rows={1}
                value={text}
                disabled={!enabled || (!hasTicket && !topic)}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={!hasTicket && !topic ? (es ? "Elige una opción arriba…" : "Pick an option above…") : es ? "Escribe tu mensaje…" : "Type your message…"}
                className="input max-h-32 min-h-11 flex-1 resize-none py-2.5 text-base"
              />
              <button type="submit" disabled={busy || !text.trim() || !enabled || (!hasTicket && !topic)} className="btn-primary h-11 shrink-0 px-4 text-sm">{busy ? "…" : es ? "Enviar" : "Send"}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
