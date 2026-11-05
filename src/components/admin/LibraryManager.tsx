"use client";

import { useRouter } from "next/navigation";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";

type Item = { id: string; kind: "championship" | "team" | "partner"; name: string; logoUrl: string | null };

/** Admin: official league / competition / team logos that every user can pick. */
export function LibraryManager({ initial }: { initial: Item[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [items, setItems] = useState(initial);
  const router = useRouter();
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
      router.refresh();
      setName("");
      setLogo(null);
      setTab(kind);
      setMsg(es ? "✅ Agregado — ya aparece para todos" : "✅ Added — everyone can pick it now");
    } else setMsg(es ? "❌ No se pudo agregar" : "❌ Couldn't add it");
  }

  async function remove(id: string) {
    setItems((x) => x.filter((i) => i.id !== id));
    await fetch(`/api/admin/library/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const shown = items.filter((i) => i.kind === tab);
  const [work, setWork] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  async function cutout(i: Item) {
    setWork(i.id);
    setNote((n) => ({ ...n, [i.id]: "" }));
    const r = await fetch(`/api/admin/library/${i.id}/cutout`, { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setWork(null);
    if (d?.ok) {
      setItems((list) => list.map((x) => (x.id === i.id ? { ...x, logoUrl: d.url } : x)));
      setNote((n) => ({ ...n, [i.id]: es ? "✅ PNG sin fondo" : "✅ Transparent PNG" }));
    } else
      setNote((n) => ({
        ...n,
        [i.id]:
          d?.error === "not_configured"
            ? es ? "❌ Este fondo no es de un solo color; para fondos complejos agrega REPLICATE_API_TOKEN en Vercel." : "❌ This background isn't one solid colour; for complex backgrounds add REPLICATE_API_TOKEN in Vercel."
            : `❌ ${d?.detail ?? d?.error ?? "failed"}`,
      }));
  }
  async function changeLogo(i: Item, url: string | null) {
    await fetch(`/api/admin/library/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl: url }) }).catch(() => {});
    setItems((list) => list.map((x) => (x.id === i.id ? { ...x, logoUrl: url } : x)));
    setEditing(null);
  }
  const kinds: [Item["kind"], string][] = [
    ["championship", es ? "🏆 Ligas / torneos" : "🏆 Leagues / competitions"],
    ["team", es ? "🛡️ Equipos" : "🛡️ Teams"],
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
          {kind === "championship"
            ? es
              ? "Las ligas también aparecen abajo en la página principal en “Confían en KIXO”. Mejor un PNG con fondo transparente."
              : "Leagues also show at the bottom of the home page under “Trusted by”. A PNG with a transparent background works best."
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
                <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
                  <button type="button" onClick={() => setEditing(editing === i.id ? null : i.id)} className="text-teal hover:underline">
                    {es ? "Cambiar logo" : "Change logo"}
                  </button>
                  {i.logoUrl && (
                    <button type="button" disabled={work === i.id} onClick={() => cutout(i)} className="text-lime hover:underline disabled:opacity-50">
                      {work === i.id ? "…" : es ? "✂️ PNG sin fondo" : "✂️ Make PNG (no background)"}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(i.id)} className="text-danger hover:underline">
                    {es ? "Eliminar" : "Delete"}
                  </button>
                </div>
                {note[i.id] && <div className="mt-1 text-[11px] text-muted">{note[i.id]}</div>}
                {editing === i.id && (
                  <div className="mt-2 text-left">
                    <ImageDrop kind="logo" label={es ? "Nuevo logo" : "New logo"} value={i.logoUrl} onChange={(u) => changeLogo(i, u)} searchQuery={i.name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
