"use client";

import { useEffect, useState } from "react";

type Ch = { key: string; label: string; labelEs: string; connected: boolean };

/** Admin: one Discord channel per kind of log. */
export function DiscordLogs({ es }: { es: boolean }) {
  const [d, setD] = useState<{ main: boolean; canAuto: boolean; channels: Ch[] } | null>(null);
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

  if (!d) return <div className="card p-5 text-sm text-muted">…</div>;
  return (
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
  );
}
