"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";

export interface SavedItem {
  id: string;
  name: string;
  logoUrl: string | null;
}

const cache: Record<string, SavedItem[] | undefined> = {};
const listeners = new Set<() => void>();

async function load(kind: string) {
  const res = await fetch(`/api/saved?kind=${kind}`);
  const data = await res.json().catch(() => ({ items: [] }));
  cache[kind] = data.items ?? [];
  listeners.forEach((l) => l());
}

/** Pick a saved team / championship, or register a new one (name + logo) inline. */
export function SavedPicker({
  kind,
  label,
  value,
  onChange,
  required,
}: {
  kind: "team" | "championship";
  label: string;
  value: SavedItem | null;
  onChange: (v: SavedItem | null) => void;
  required?: boolean;
}) {
  const { locale } = useT();
  const es = locale === "es";
  const [items, setItems] = useState<SavedItem[] | undefined>(cache[kind]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const l = () => setItems(cache[kind]);
    listeners.add(l);
    if (!cache[kind]) load(kind);
    return () => {
      listeners.delete(l);
    };
  }, [kind]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, logoUrl: logo }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.item) {
      cache[kind] = [data.item, ...(cache[kind] ?? [])];
      listeners.forEach((l) => l());
      onChange(data.item);
      setAdding(false);
      setOpen(false);
      setName("");
      setLogo(null);
    }
  }

  const addLabel = kind === "team" ? (es ? "Registrar nuevo equipo" : "Add new team") : es ? "Registrar nuevo torneo" : "Add new championship";

  return (
    <div className="relative">
      <span className="label">
        {label} {required && <span className="text-lime">*</span>}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`input flex items-center gap-3 text-left ${open ? "border-lime" : ""}`}
      >
        {value?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
        )}
        <span className={value ? "" : "text-muted/70"}>{value?.name ?? (es ? "Elegir o registrar…" : "Select or register…")}</span>
        <span className="ml-auto text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="card absolute z-30 mt-1 max-h-72 w-full overflow-y-auto p-1 shadow-2xl shadow-black">
          {value && (
            <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-panel-2" onClick={() => { onChange(null); setOpen(false); }}>
              ✕ {es ? "Quitar" : "Clear"}
            </button>
          )}
          {items === undefined && <p className="px-3 py-2 text-sm text-muted">…</p>}
          {items?.length === 0 && <p className="px-3 py-2 text-sm text-muted">{es ? "Nada guardado aún" : "Nothing saved yet"}</p>}
          {items?.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => { onChange(it); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2"
            >
              {it.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.logoUrl} alt="" className="h-7 w-7 rounded object-contain" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded bg-panel-2 text-xs">{it.name[0]}</span>
              )}
              {it.name}
            </button>
          ))}
          <button type="button" onClick={() => setAdding(true)} className="mt-1 w-full rounded-lg border-t border-line px-3 py-2.5 text-left text-sm font-bold text-lime hover:bg-panel-2">
            ＋ {addLabel}
          </button>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setAdding(false)}>
          <div className="card w-full max-w-sm space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{addLabel}</h3>
              <button type="button" onClick={() => setAdding(false)} className="text-muted">✕</button>
            </div>
            <div>
              <label className="label">{es ? "Nombre" : "Name"} *</label>
              <input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <ImageDrop kind="logo" label={es ? "Logo (opcional)" : "Logo (optional)"} value={logo} onChange={setLogo} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>{es ? "Cancelar" : "Cancel"}</button>
              <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? "…" : es ? "Guardar" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
