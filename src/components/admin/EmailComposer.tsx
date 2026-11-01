"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";
import { renderEmail } from "@/lib/email-template";

type Info = { ready: boolean; all: number; optedOut: number; history: { subject: string; sent: number; audience: string; at: string }[] };

/** Admin: write a promo email, preview it, send a test to yourself, then send to everyone. */
export function EmailComposer() {
  const { locale } = useT();
  const es = locale === "es";
  const [info, setInfo] = useState<Info | null>(null);
  const [c, setC] = useState({
    subject: es ? "🔥 Créditos al 50% solo este fin de semana" : "🔥 50% off credits this weekend only",
    heading: es ? "¡Hola {name}! Oferta especial" : "Hey {name}! Special offer",
    body: es
      ? "Este fin de semana todos los paquetes de créditos tienen descuento.\nCrea pósters pro para tu equipo, torneos y fichajes en segundos."
      : "This weekend every credit pack is on sale.\nMake pro posters for your team, tournaments and signings in seconds.",
    imageUrl: null as string | null,
    ctaLabel: es ? "Ver la oferta" : "See the deal",
    ctaUrl: "/pricing",
    audience: "all" as "all" | "buyers" | "never_bought",
  });
  const [busy, setBusy] = useState<"" | "test" | "all">("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);

  const load = () => fetch("/api/admin/email").then((r) => r.json()).then(setInfo).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const html = useMemo(() => renderEmail(c, { name: "Alex", unsub: "#", es }), [c, es]);
  const set = (k: keyof typeof c, v: string | null) => {
    setC((x) => ({ ...x, [k]: v }));
    setConfirm(false);
    setMsg("");
  };

  async function send(mode: "test" | "all") {
    if (mode === "all" && !confirm) return setConfirm(true);
    setBusy(mode);
    setMsg("");
    const r = await fetch("/api/admin/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, mode }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    setConfirm(false);
    if (r.ok) {
      setMsg(mode === "test" ? (es ? "✅ Prueba enviada a tu correo" : "✅ Test sent to your email") : es ? `✅ Enviado a ${d.sent} usuarios` : `✅ Sent to ${d.sent} users`);
      load();
    } else setMsg(`❌ ${d.detail || d.error || "error"}`);
  }

  const reach = info ? info.all - info.optedOut : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card space-y-4 p-5">
        {info && !info.ready && (
          <div className="rounded-xl border border-teal/40 bg-teal/5 p-3 text-xs text-muted">
            {es ? "Para enviar correos falta conectar Resend: crea una cuenta en resend.com, verifica tu dominio kixo.pro y pon RESEND_API_KEY en Vercel." : "To send emails, connect Resend: make an account at resend.com, verify your kixo.pro domain and add RESEND_API_KEY in Vercel."}
          </div>
        )}
        <div>
          <label className="label">{es ? "Asunto" : "Subject"}</label>
          <input className="input" maxLength={150} value={c.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div>
          <label className="label">{es ? "Título (usa {name} para el nombre)" : "Heading (use {name} for their name)"}</label>
          <input className="input" maxLength={120} value={c.heading} onChange={(e) => set("heading", e.target.value)} />
        </div>
        <div>
          <label className="label">{es ? "Mensaje" : "Message"}</label>
          <textarea className="input min-h-32 py-2 text-sm" maxLength={5000} value={c.body} onChange={(e) => set("body", e.target.value)} />
        </div>
        <ImageDrop noSearch kind="photo" label={es ? "Imagen (opcional — un póster o banner de la promo)" : "Image (optional — a poster or promo banner)"} value={c.imageUrl} onChange={(u) => set("imageUrl", u)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{es ? "Texto del botón" : "Button text"}</label>
            <input className="input" maxLength={40} value={c.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
          </div>
          <div>
            <label className="label">{es ? "Enlace del botón" : "Button link"}</label>
            <input className="input" maxLength={400} value={c.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="/pricing" />
          </div>
        </div>
        <div>
          <label className="label">{es ? "¿A quién?" : "Who gets it?"}</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", es ? "Todos" : "Everyone"],
                ["buyers", es ? "Los que compraron" : "Buyers"],
                ["never_bought", es ? "Nunca compraron" : "Never bought"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" onClick={() => set("audience", v)} className={`chip ${c.audience === v ? "border-lime bg-lime text-ink" : "text-muted"}`}>
                {l}
              </button>
            ))}
          </div>
          {info && (
            <p className="mt-2 text-xs text-muted">
              {es ? `${reach} usuarios suscritos · ${info.optedOut} dados de baja` : `${reach} subscribed users · ${info.optedOut} unsubscribed`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost px-4" disabled={!!busy || !info?.ready} onClick={() => send("test")}>
            {busy === "test" ? "…" : es ? "📨 Enviarme una prueba" : "📨 Send me a test"}
          </button>
          <button type="button" className={`px-5 ${confirm ? "rounded-lg bg-danger py-2.5 text-sm font-bold text-white" : "btn-primary"}`} disabled={!!busy || !info?.ready} onClick={() => send("all")}>
            {busy === "all" ? (es ? "Enviando…" : "Sending…") : confirm ? (es ? "Toca otra vez para confirmar" : "Tap again to confirm") : es ? "🚀 Enviar a todos" : "🚀 Send to everyone"}
          </button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        {info?.history?.length ? (
          <div className="border-t border-line pt-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-teal">{es ? "Enviados" : "Sent"}</div>
            <ul className="space-y-1 text-xs text-muted">
              {info.history.map((h) => (
                <li key={h.at} className="flex justify-between gap-2">
                  <span className="truncate">{h.subject}</span>
                  <span className="shrink-0">{h.sent} · {new Date(h.at).toLocaleDateString(locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-teal">{es ? "Vista previa" : "Preview"}</div>
        <div className="overflow-hidden rounded-2xl border border-line">
          <iframe title="preview" srcDoc={html} className="h-[640px] w-full bg-[#090d0b]" />
        </div>
      </div>
    </div>
  );
}
