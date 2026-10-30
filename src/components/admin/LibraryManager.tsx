"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";

type Item = { id: string; kind: "championship" | "team" | "partner"; name: string; logoUrl: string | null };

/** Admin: official league / competition / team logos that every user can pick. */
export function LibraryManager({ initial }: { initial: Item[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<Item["kind"]>("championship");
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<Item["kind"]>("championship");

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, logoUrl: logo }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.item) {
      setItems((x) => [...x, data.item]);
      setName("");
      setLogo(null);
      setTab(kind);
      setMsg(es ? "✅ Agregado — ya aparece para todos" : "✅ Added — everyone can pick it now");
    } else setMsg(es ? "❌ No se pudo agregar" : "❌ Couldn't add it");
  }

  async function remove(id: string) {
    setItems((x) => x.filter((i) => i.id !== id));
    await fetch(`/api/admin/library/${id}`, { method: "DELETE" });
  }

  const shown = items.filter((i) => i.kind === tab);
  const kinds: [Item["kind"], string][] = [
    ["championship", es ? "🏆 Ligas / torneos" : "🏆 Leagues / competitions"],
    ["team", es ? "🛡️ Equipos" : "🛡️ Teams"],
    ["partner", es ? "🤝 Organizaciones" : "🤝 Organizations"],
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {es
          ? "Los logos que agregues aquí aparecen para todos los usuarios como “⭐ Oficiales” al crear un póster. Si su liga o equipo no está, ellos pueden subir el suyo."
          : "Logos you add here show up for every user as “⭐ Official” when making a poster. If their league or team isn't there, they can still upload their own."}
      </p>

      <div className="card space-y-4 p-5">
        <div className="font-bold">{es ? "Agregar logo oficial" : "Add an official logo"}</div>
        <div className="flex gap-2">
          {kinds.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${kind === k ? "border-lime bg-lime/10 text-lime" : "border-line bg-panel-2"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label">{es ? "Nombre" : "Name"} *</label>
            <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "championship" ? "Liga MX, VPG, Copa KIXO…" : kind === "partner" ? "AFH Afterhours, VPG…" : "SMT, Chivas…"} />
          </div>
          <ImageDrop kind="logo" label="Logo" value={logo} onChange={setLogo} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={add}>
            {busy ? "…" : es ? "＋ Agregar" : "＋ Add"}
          </button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
        <p className="text-xs text-muted">
          {kind === "partner"
            ? es
              ? "Las organizaciones aparecen abajo en la página principal en “Confían en KIXO”. Mejor un PNG con fondo transparente."
              : "Organizations show at the bottom of the home page under “Trusted by”. A PNG with a transparent background works best."
            : es
              ? "Mejor un PNG con fondo transparente."
              : "A PNG with a transparent background works best."}
        </p>
      </div>

      <div>
        <div className="mb-3 flex gap-2">
          {kinds.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`chip ${tab === k ? "border-lime bg-lime text-ink" : "text-muted"}`}>
              {l} ({items.filter((i) => i.kind === k).length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">{es ? "Aún no hay ninguno." : "None yet."}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shown.map((i) => (
              <div key={i.id} className="card group relative p-3 text-center">
                {i.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.logoUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
                ) : (
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-xl bg-panel-2 text-2xl font-bold">{i.name[0]}</div>
                )}
                <div className="mt-2 truncate text-sm font-bold">{i.name}</div>
                <button type="button" onClick={() => remove(i.id)} className="mt-1 text-xs text-danger hover:underline">
                  {es ? "Eliminar" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
