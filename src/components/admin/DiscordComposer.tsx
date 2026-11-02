"use client";

import { useEffect, useState } from "react";

type Info = { ready: boolean; bot: { ok: boolean; name?: string; error?: string }; guild: boolean; linked: number; history: { at: string; preview: string; sent: number; closed: number; failed: number; total: number }[] };

export function DiscordComposer({ es }: { es: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [f, setF] = useState({ content: "", title: "", imageUrl: "", linkUrl: "https://kixo.pro/create", linkLabel: es ? "Crear ahora" : "Create now" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);

  const load = () => fetch("/api/admin/discord-dm").then((r) => r.json()).then(setInfo).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function send(mode: "test" | "all") {
    setBusy(mode);
    setMsg("");
    const r = await fetch("/api/admin/discord-dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ...f }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    setConfirm(false);
    if (!r.ok)
      return setMsg(
        d.error === "admin_not_linked"
          ? es ? "❌ Conecta tu Discord en Perfil para recibir la prueba." : "❌ Connect your Discord in Profile to get the test."
          : d.error === "bot_missing" ? (es ? "❌ Falta DISCORD_BOT_TOKEN en Vercel." : "❌ DISCORD_BOT_TOKEN is missing in Vercel.") : es ? "❌ No se pudo enviar" : "❌ Couldn't send",
      );
    setMsg(`✅ ${es ? "Enviados" : "Sent"}: ${d.sent}${d.closed ? ` · ${es ? "DMs cerrados" : "DMs closed"}: ${d.closed}` : ""}${d.failed ? ` · ${es ? "Fallaron" : "Failed"}: ${d.failed}` : ""}`);
    load();
  }

  const botLine = !info
    ? "…"
    : !info.ready
      ? es ? "❌ Falta DISCORD_BOT_TOKEN en Vercel" : "❌ DISCORD_BOT_TOKEN missing in Vercel"
      : info.bot.ok
        ? `✅ ${es ? "Bot conectado" : "Bot connected"}: ${info.bot.name}`
        : info.bot.error === "bad_token" ? (es ? "❌ El token del bot no es válido" : "❌ The bot token is not valid") : `⚠️ ${info.bot.error}`;

  return (
    <div className="space-y-5">
      <div className="card space-y-1.5 p-4 text-sm">
        <div>{botLine}</div>
        <div>{info ? (info.guild ? (es ? "✅ Servidor configurado — los nuevos usuarios de Discord se unen solos" : "✅ Server set — new Discord sign-ups join it automatically") : es ? "⚠️ Sin DISCORD_GUILD_ID — los usuarios no se unen solos a tu servidor" : "⚠️ No DISCORD_GUILD_ID — users won't auto-join your server") : ""}</div>
        <div className="font-bold">👥 {info?.linked ?? "…"} {es ? "usuarios con Discord conectado" : "users with Discord linked"}</div>
        <p className="text-xs text-muted">{es ? "Discord solo deja que un bot escriba a quien comparte un servidor con él y tiene los DMs abiertos." : "Discord only lets a bot DM people who share a server with it and have DMs open."}</p>
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <label className="label">{es ? "Título (opcional)" : "Title (optional)"}</label>
          <input className="input" maxLength={250} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={es ? "🔥 Nuevos estilos de Campeones" : "🔥 New Champions styles"} />
        </div>
        <div>
          <label className="label">{es ? "Mensaje" : "Message"} *</label>
          <textarea className="input min-h-32" maxLength={2000} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder={es ? "Hola! Ya puedes crear pósters de campeones…" : "Hey! You can now make champions posters…"} />
          <p className="mt-1 text-[11px] text-muted">{f.content.length}/2000</p>
        </div>
        <div>
          <label className="label">{es ? "Imagen (enlace https, opcional)" : "Image (https link, optional)"}</label>
          <input className="input" maxLength={600} value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
          <div>
            <label className="label">{es ? "Botón: enlace" : "Button link"}</label>
            <input className="input" value={f.linkUrl} onChange={(e) => setF({ ...f, linkUrl: e.target.value })} />
          </div>
          <div>
            <label className="label">{es ? "Texto" : "Label"}</label>
            <input className="input" maxLength={80} value={f.linkLabel} onChange={(e) => setF({ ...f, linkLabel: e.target.value })} />
          </div>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={!f.content.trim() || !!busy || !info?.ready} onClick={() => send("test")}>
            {busy === "test" ? "…" : es ? "📨 Enviarme una prueba" : "📨 Send me a test"}
          </button>
          {confirm ? (
            <button type="button" className="rounded-xl bg-danger px-4 py-2.5 font-bold text-white" disabled={!!busy} onClick={() => send("all")}>
              {busy === "all" ? (es ? "Enviando…" : "Sending…") : es ? `¿Seguro? Enviar a ${info?.linked ?? 0}` : `Sure? Send to ${info?.linked ?? 0}`}
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={!f.content.trim() || !!busy || !info?.ready || !info?.linked} onClick={() => setConfirm(true)}>
              🚀 {es ? "Enviar a todos" : "Send to everyone"}
            </button>
          )}
        </div>
      </div>

      {!!info?.history.length && (
        <div className="card p-4 text-sm">
          <div className="mb-2 font-bold">{es ? "Envíos anteriores" : "Past sends"}</div>
          <ul className="space-y-1.5 text-xs text-muted">
            {info.history.map((h) => (
              <li key={h.at}>
                {new Date(h.at).toLocaleString()} — “{h.preview}” · ✅ {h.sent}/{h.total}
                {h.closed ? ` · 🔒 ${h.closed}` : ""}
                {h.failed ? ` · ❌ ${h.failed}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
