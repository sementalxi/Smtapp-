"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { ImageDrop } from "../ImageDrop";

type W = { on: boolean; title: string; content: string; imageUrls: string[]; linkUrl: string; linkLabel: string };

/** Admin: the welcome DM the bot sends when someone signs up with / connects Discord. */
export function WelcomeDmEditor({ es }: { es: boolean }) {
  const [w, setW] = useState<W | null>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/admin/welcome-dm").then((r) => r.json()).then(setW).catch(() => {});
  }, []);
  if (!w) return <div className="card p-5 text-sm text-muted">…</div>;
  const set = (p: Partial<W>) => setW({ ...w, ...p });
  const fill = (s: string) => s.replaceAll("{name}", "Alex").replaceAll("{credits}", "13").replaceAll("{discord}", "alex_10");

  async function save(next = w!) {
    setBusy("save");
    setMsg("");
    const r = await fetch("/api/admin/welcome-dm", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setBusy("");
    const e = r.ok ? null : await r.json().catch(() => ({}));
    if (r.ok) router.refresh();
    setMsg(r.ok ? (next.on ? (es ? "✅ Guardado — se enviará a cada cuenta nueva con Discord" : "✅ Saved — it'll be sent to every new Discord account") : es ? "✅ Guardado (apagado)" : "✅ Saved (off)") : `❌ ${e?.error ?? (es ? "No se pudo guardar" : "Couldn't save")}`);
  }
  async function test() {
    setBusy("test");
    setMsg("");
    const r = await fetch("/api/admin/welcome-dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) }).then((x) => x.json()).catch(() => ({ result: "error" }));
    setBusy("");
    setMsg(
      r.result === "ok"
        ? es ? "✅ Te lo envié por DM — revisa Discord" : "✅ Sent to your DMs — check Discord"
        : r.result === "no_discord"
          ? es ? "❌ Conecta tu propio Discord en tu Perfil para probar" : "❌ Connect your own Discord on your Profile to test"
          : `❌ ${es ? "No se pudo enviar" : "Couldn't send"}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">👋 {es ? "Mensaje de bienvenida (DM)" : "Welcome message (DM)"}</h2>
          <p className="text-sm text-muted">
            {es
              ? "El bot lo envía por mensaje directo cuando alguien crea su cuenta con Discord o conecta Discord. Una vez por cuenta."
              : "The bot sends it as a direct message when someone signs up with Discord or connects Discord. Once per account."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={w.on}
          disabled={!!busy}
          onClick={() => { const n = { ...w, on: !w.on }; setW(n); save(n); }}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider ${w.on ? "border-lime bg-lime/15 text-lime" : "border-line text-muted"}`}
        >
          {w.on ? (es ? "Encendido" : "On") : es ? "Apagado" : "Off"}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <span className="label">{es ? "Título" : "Title"}</span>
          <input className="input" maxLength={250} value={w.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <span className="label">{es ? "Mensaje" : "Message"}</span>
          <textarea className="input min-h-[140px]" maxLength={4000} value={w.content} onChange={(e) => set({ content: e.target.value })} />
          <p className="mt-1 text-xs text-muted">
            {es ? "Usa " : "Use "}<code>{"{name}"}</code>, <code>{"{credits}"}</code>, <code>{"{discord}"}</code>{es ? " — se cambian por los datos de cada persona. **negrita**, *cursiva* y saltos de línea funcionan." : " — they're replaced with each person's info. **bold**, *italic* and line breaks work."}
          </p>
        </div>
        <div>
          <span className="label">{es ? "Imágenes (hasta 4)" : "Pictures (up to 4)"}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((n) => (
              <ImageDrop
                key={n}
                noSearch
                kind="photo"
                label={`#${n + 1}`}
                value={w.imageUrls[n] ?? null}
                onChange={(url) => {
                  const list = [...w.imageUrls];
                  if (url) list[n] = url;
                  else list.splice(n, 1);
                  set({ imageUrls: list.filter(Boolean).slice(0, 4) });
                }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="label">{es ? "Texto del botón" : "Button text"}</span>
            <input className="input" maxLength={80} value={w.linkLabel} onChange={(e) => set({ linkLabel: e.target.value })} />
          </div>
          <div>
            <span className="label">{es ? "Enlace del botón" : "Button link"}</span>
            <input className="input" maxLength={500} placeholder="https://kixo.pro/create" value={w.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Preview — roughly how it looks in Discord */}
      <div className="rounded-xl bg-[#313338] p-3 text-left">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ff2e88] text-xs font-black">K</span>
          <b>KIXO</b>
          <span className="rounded bg-[#5865F2] px-1 text-[10px] font-bold">APP</span>
        </div>
        <div className="mt-2 rounded border-l-4 border-[#ff2e88] bg-[#2b2d31] p-3">
          {w.title && <div className="text-sm font-bold text-white">{fill(w.title)}</div>}
          <div className="mt-1 whitespace-pre-wrap text-[13px] text-white/85">{fill(w.content).replace(/\*\*(.+?)\*\*/g, "$1")}</div>
          {w.imageUrls[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.imageUrls[0]} alt="" className="mt-2 max-h-56 w-full rounded object-cover" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {w.linkUrl && <span className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-bold">🔥 {fill(w.linkLabel || "Open KIXO")} ↗</span>}
          <span className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-bold">🌐 kixo.pro ↗</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy} onClick={() => save()} className="btn-primary px-5 py-2 text-sm">{busy === "save" ? "…" : es ? "Guardar" : "Save"}</button>
        <button type="button" disabled={!!busy} onClick={test} className="btn-ghost px-4 py-2 text-sm">{busy === "test" ? "…" : es ? "📨 Enviarme una prueba" : "📨 Send me a test"}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
