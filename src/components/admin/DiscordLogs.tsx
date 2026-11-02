"use client";

import { useEffect, useState } from "react";

type Ch = { key: string; label: string; labelEs: string; connected: boolean };

/** Admin: one Discord channel per kind of log. */
export function DiscordLogs({ es }: { es: boolean }) {
  const [d, setD] = useState<{ main: boolean; canAuto: boolean; bot: boolean; showcase: boolean; showcaseTypes: Ch[]; channels: Ch[] } | null>(null);
  const [typeEdit, setTypeEdit] = useState<string | null>(null);
  const [typeCh, setTypeCh] = useState("");
  const [chId, setChId] = useState("");
  const [scUrl, setScUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  const load = () => fetch("/api/admin/discord-logs").then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => {
    load();
  }, []);
  const post = (body: object) => fetch("/api/admin/discord-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));

  async function auto() {
    setBusy("auto");
    setMsg("");
    const r = await post({ action: "auto" });
    setBusy("");
    setMsg(
      r.ok
        ? es ? "✅ Canales creados en tu servidor (categoría 📊 KIXO LOGS, privada)." : "✅ Channels created in your server (private 📊 KIXO LOGS category)."
        : r.error === "no_permission" || r.error === "no_webhook_permission"
          ? es ? "❌ El bot necesita permisos: en Discord → Ajustes del servidor → Roles → KIXO → activa “Gestionar canales” y “Gestionar webhooks”. Luego vuelve a tocar." : "❌ The bot needs permissions: Discord → Server Settings → Roles → KIXO → turn on “Manage Channels” and “Manage Webhooks”, then tap again."
          : `❌ ${r.error ?? "error"}`,
    );
    load();
  }
  async function test(key: string) {
    setBusy(key);
    const r = await post({ action: "test", key });
    setBusy("");
    setMsg(r.ok ? (es ? "✅ Prueba enviada — revisa Discord" : "✅ Test sent — check Discord") : es ? "❌ No hay canal conectado" : "❌ No channel connected");
  }
  async function save(key: string) {
    setBusy(key);
    await post({ action: "set", key, url });
    setBusy("");
    setEdit(null);
    setUrl("");
    load();
  }

  async function showcase(body: object, okMsg: string) {
    setBusy("sc");
    const r = await post(body);
    setBusy("");
    setMsg(
      r.ok
        ? okMsg
        : r.error === "no_webhook_permission"
          ? es ? "❌ El bot necesita “Gestionar webhooks” en ese canal." : "❌ The bot needs “Manage Webhooks” in that channel."
          : r.error === "no_channel" ? (es ? "❌ No encontré ese canal (¿ID correcto? ¿el bot lo ve?)" : "❌ Couldn't find that channel (right ID? can the bot see it?)")
          : r.error === "no_channels" ? (es ? "❌ El bot no ve canales en tu servidor" : "❌ The bot can't see any channels in your server")
          : `❌ ${r.error ?? "error"}`,
    );
    if (r.ok && Array.isArray(r.done)) setMsg(r.done.length ? `✅ ${es ? "Conectados" : "Connected"}: ${r.done.join(" · ")}` : es ? "⚠️ No encontré canales con esos nombres" : "⚠️ No channels with those names found");
    setChId("");
    setScUrl("");
    setTypeEdit(null);
    setTypeCh("");
    load();
  }

  if (!d) return <div className="card p-5 text-sm text-muted">…</div>;
  return (
    <>
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{es ? "🌍 Vitrina pública" : "🌍 Public showcase"}</h2>
          <p className="text-xs text-muted">{es ? "Cada póster terminado se publica en tu canal público con el nombre del jugador (sin emails). Los usuarios pueden desactivarlo en su Perfil." : "Every finished poster is posted to your public channel with the player's name (no emails). Users can turn it off in their Profile."}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${d.showcase ? "bg-teal/15 text-teal" : "bg-panel-2 text-muted"}`}>{d.showcase || d.showcaseTypes.some((t) => t.connected) ? (es ? "Activa" : "On") : es ? "Apagada" : "Off"}</span>
      </div>
      {d.bot && (
        <div className="space-y-2 rounded-xl border border-line bg-panel-2/40 p-3">
          <div className="text-xs font-bold">{es ? "Un canal por tipo de póster" : "One channel per poster type"}</div>
          <button type="button" className="btn-primary w-full py-2.5 text-sm" disabled={!!busy} onClick={() => showcase({ action: "showcase_auto" }, "✅")}>
            {busy === "sc" ? "…" : es ? "⚡ Conectar cada tipo a su canal (por nombre)" : "⚡ Connect each type to its channel (by name)"}
          </button>
          <ul className="divide-y divide-line">
            {d.showcaseTypes.map((t) => (
              <li key={t.key} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{es ? t.labelEs : t.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.connected ? "bg-teal/15 text-teal" : "bg-panel-2 text-muted"}`}>{t.connected ? (es ? "Conectado" : "Connected") : es ? "Sin canal" : "No channel"}</span>
                  <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => { setTypeEdit(typeEdit === t.key ? null : t.key); setTypeCh(""); }}>✏️</button>
                </div>
                {typeEdit === t.key && (
                  <div className="mt-2 flex gap-2">
                    <input className="input min-w-0 flex-1 py-2 text-xs" inputMode="numeric" placeholder={es ? "ID del canal (vacío = quitar)" : "Channel ID (empty = remove)"} value={typeCh} onChange={(e) => setTypeCh(e.target.value.replace(/\D/g, ""))} />
                    <button type="button" className="btn-primary px-3 py-2 text-xs" disabled={!!busy} onClick={() => showcase({ action: "showcase_type", key: t.key, channelId: typeCh }, es ? "✅ Guardado" : "✅ Saved")}>{es ? "Guardar" : "Save"}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">{es ? "Tipos sin canal usan el canal general de abajo (si hay)." : "Types without a channel use the general channel below (if set)."}</p>
        </div>
      )}
      {d.bot && (
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1 py-2 text-sm" inputMode="numeric" placeholder={es ? "ID del canal (mantén pulsado el canal → Copiar ID)" : "Channel ID (long-press the channel → Copy ID)"} value={chId} onChange={(e) => setChId(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className="btn-primary px-3 py-2 text-xs" disabled={!!busy || chId.length < 15} onClick={() => showcase({ action: "showcase_channel", channelId: chId }, es ? "✅ Vitrina conectada a ese canal" : "✅ Showcase connected to that channel")}>{busy === "sc" ? "…" : es ? "Conectar" : "Connect"}</button>
        </div>
      )}
      <div className="flex gap-2">
        <input className="input min-w-0 flex-1 py-2 text-xs" placeholder={es ? "…o pega el webhook del canal" : "…or paste the channel's webhook"} value={scUrl} onChange={(e) => setScUrl(e.target.value)} />
        <button type="button" className="btn-ghost px-3 py-2 text-xs" disabled={!!busy || !scUrl.trim()} onClick={() => showcase({ action: "showcase_set", url: scUrl }, es ? "✅ Guardado" : "✅ Saved")}>{es ? "Guardar" : "Save"}</button>
      </div>
      {d.showcase && (
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1 py-2 text-xs" disabled={!!busy} onClick={() => showcase({ action: "showcase_test" }, es ? "✅ Prueba enviada" : "✅ Test sent")}>{es ? "Enviar prueba" : "Send test"}</button>
          <button type="button" className="btn-ghost py-2 text-xs" disabled={!!busy} onClick={() => showcase({ action: "showcase_set", url: "" }, es ? "Vitrina apagada" : "Showcase off")}>{es ? "Apagar" : "Turn off"}</button>
        </div>
      )}
    </div>
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-bold">{es ? "📊 Registros en Discord" : "📊 Discord logs"}</h2>
        <p className="text-xs text-muted">{es ? "Cada cosa en su propio canal. Lo que no tenga canal va al webhook principal." : "Every kind in its own channel. Anything without a channel goes to the main webhook."}</p>
      </div>
      {d.canAuto && (
        <button type="button" className="btn-primary w-full py-3" disabled={!!busy} onClick={auto}>
          {busy === "auto" ? "…" : es ? "⚡ Crear todos los canales con mi bot" : "⚡ Create all channels with my bot"}
        </button>
      )}
      {msg && <p className="text-sm">{msg}</p>}
      <ul className="divide-y divide-line">
        {d.channels.map((c) => (
          <li key={c.key} className="py-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{es ? c.labelEs : c.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.connected ? "bg-teal/15 text-teal" : d.main ? "bg-panel-2 text-muted" : "bg-danger/15 text-danger"}`}>
                {c.connected ? (es ? "Conectado" : "Connected") : d.main ? (es ? "Principal" : "Main") : es ? "Apagado" : "Off"}
              </span>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" disabled={!!busy} onClick={() => test(c.key)}>{busy === c.key ? "…" : es ? "Probar" : "Test"}</button>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => { setEdit(edit === c.key ? null : c.key); setUrl(""); }}>✏️</button>
            </div>
            {edit === c.key && (
              <div className="mt-2 flex gap-2">
                <input className="input min-w-0 flex-1 py-2 text-xs" placeholder={es ? "Pega el webhook del canal (vacío = quitar)" : "Paste the channel webhook (empty = remove)"} value={url} onChange={(e) => setUrl(e.target.value)} />
                <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={() => save(c.key)}>{es ? "Guardar" : "Save"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
    </>
  );
}
