"use client";

import { useEffect, useRef, useState } from "react";

type Info = { ready: boolean; bot: { ok: boolean; name?: string; error?: string }; guild: boolean; linked: number; history: { at: string; preview: string; sent: number; closed: number; failed: number; total: number }[] };

export function DiscordComposer({ es }: { es: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [upBusy, setUpBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  async function addFiles(files: FileList | null) {
    if (!files) return;
    setUpBusy(true);
    for (const file of Array.from(files).slice(0, 4 - imgs.length)) {
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) continue;
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("kind", "photo");
      const d = await fetch("/api/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
      if (d.url) setImgs((x) => [...x, d.url].slice(0, 4));
      else setMsg(es ? "❌ Una imagen no se pudo subir" : "❌ An image couldn't be uploaded");
    }
    setUpBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  const [f, setF] = useState({ content: "", title: "", linkUrl: "https://kixo.pro/create", linkLabel: es ? "Crear ahora" : "Create now" });
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
    const r = await fetch("/api/admin/discord-dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, ...f, imageUrls: imgs }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    setConfirm(false);
    if (!r.ok)
      return setMsg(
        d.error === "admin_not_linked"
          ? es ? "❌ Conecta tu Discord en Perfil para recibir la prueba." : "❌ Connect your Discord in Profile to get the test."
          : d.error === "bot_missing" ? (es ? "❌ Falta DISCORD_BOT_TOKEN en Vercel." : "❌ DISCORD_BOT_TOKEN is missing in Vercel.") : es ? "❌ No se pudo enviar" : "❌ Couldn't send",
      );
    const why =
      d.inServer === false
        ? es ? " — Tu cuenta de Discord NO está en tu servidor (o el bot no está en él)." : " — Your Discord account is NOT in your server (or the bot isn't in it)."
        : /50007/.test(d.detail ?? "")
          ? es ? " — Discord bloquea los DMs: activa “Mensajes directos” en la privacidad del servidor." : " — Discord blocks the DM: turn on “Direct Messages” in the server's privacy settings."
          : "";
    setMsg(`${d.sent ? "✅" : "⚠️"} ${es ? "Enviados" : "Sent"}: ${d.sent}${d.closed ? ` · ${es ? "DMs cerrados" : "DMs closed"}: ${d.closed}` : ""}${d.failed ? ` · ${es ? "Fallaron" : "Failed"}: ${d.failed}` : ""}${why}${d.detail ? ` (${d.detail})` : ""}`);
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
          <textarea className="input min-h-32" maxLength={4000} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder={es ? "Hola! Ya puedes crear pósters de campeones…" : "Hey! You can now make champions posters…"} />
          <p className="mt-1 text-[11px] text-muted">{f.content.length}/4000</p>
        </div>
        <div>
          <label className="label">{es ? "Imágenes (hasta 4)" : "Images (up to 4)"}</label>
          <div className="grid grid-cols-4 gap-2">
            {imgs.map((u, k) => (
              <div key={u} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove" onClick={() => setImgs((x) => x.filter((_, j) => j !== k))} className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white">✕</button>
              </div>
            ))}
            {imgs.length < 4 && (
              <button type="button" disabled={upBusy} onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line text-2xl text-muted hover:border-lime/50">
                {upBusy ? "…" : "＋"}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <p className="mt-1 text-[11px] text-muted">{es ? "Varias imágenes se muestran como galería en Discord." : "Several images show as a gallery in Discord."}</p>
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
        <div>
          <span className="label">{es ? "Vista previa" : "Preview"}</span>
          <div className="rounded-xl bg-[#313338] p-3 text-[13px] text-[#dbdee1]">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kixo-logo.png" alt="" className="h-8 w-8 rounded-full bg-lime object-contain" />
              <span className="font-bold text-white">KIXO</span>
              <span className="rounded bg-[#5865F2] px-1 text-[10px] font-bold text-white">APP</span>
            </div>
            <div className="mt-2 ml-10 overflow-hidden rounded border-l-4 border-[#ff2e88] bg-[#2b2d31] p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/kixo-logo.png" alt="" className="h-5 w-5 rounded-full bg-lime object-contain" /> KIXO
              </div>
              {f.title && <div className="mt-1.5 font-bold text-[#00a8fc]">{f.title}</div>}
              <div className="mt-1 whitespace-pre-wrap">{f.content || (es ? "Tu mensaje…" : "Your message…")}</div>
              {imgs.length > 0 && (
                <div className={`mt-2 grid gap-1 ${imgs.length > 1 ? "grid-cols-2" : ""}`}>
                  {imgs.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" className="w-full rounded object-cover" />
                  ))}
                </div>
              )}
              <div className="mt-2 text-[11px] text-[#949ba4]">kixo.pro · AI sports posters</div>
            </div>
            <div className="mt-2 ml-10 flex flex-wrap gap-2">
              {f.linkUrl && <span className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-bold text-white">🔥 {f.linkLabel || "Open KIXO"} ↗</span>}
              <span className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-bold text-white">🌐 kixo.pro ↗</span>
            </div>
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
