"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { ART_TYPES } from "@/lib/pro-options";
import type { LayoutKind } from "@/lib/templates";

export type ArrangeItem = { id: string; name: string; nameEs: string; layout: LayoutKind; active: boolean; thumbUrl: string | null; uses: number; badge: string | null };

function Switch({ on, onChange, es }: { on: boolean; onChange: (v: boolean) => void; es: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${on ? "border-lime/60 bg-lime/10 text-lime" : "border-line text-muted"}`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? "bg-lime" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {on ? (es ? "Visible" : "Shown") : es ? "Oculto" : "Hidden"}
    </button>
  );
}

const Arrow = ({ dir, onClick, disabled }: { dir: "up" | "down"; onClick: () => void; disabled: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:border-lime/60 hover:text-lime disabled:opacity-25" aria-label={dir === "up" ? "Move up" : "Move down"}>
    {dir === "up" ? "▲" : "▼"}
  </button>
);

/** Admin: reorder categories and styles, move styles between categories, show/hide both. */
export function TemplateArranger({ initial, categories }: { initial: ArrangeItem[]; categories: { order: LayoutKind[]; hidden: LayoutKind[] } }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [order, setOrder] = useState<LayoutKind[]>(categories.order);
  const [hidden, setHidden] = useState<LayoutKind[]>(categories.hidden);
  const [items, setItems] = useState<ArrangeItem[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<LayoutKind | null>(categories.order[0] ?? null);

  const touch = () => {
    setDirty(true);
    setMsg("");
  };
  const art = (l: LayoutKind) => ART_TYPES.find((a) => a.layout === l)!;

  const moveCat = (i: number, d: -1 | 1) => {
    const o = [...order];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    setOrder(o);
    touch();
  };
  const inCat = (l: LayoutKind) => items.filter((x) => x.layout === l);
  const moveTpl = (l: LayoutKind, i: number, d: -1 | 1) => {
    const list = inCat(l);
    [list[i], list[i + d]] = [list[i + d], list[i]];
    setItems([...items.filter((x) => x.layout !== l), ...list]);
    touch();
  };
  const patch = (id: string, p: Partial<ArrangeItem>) => {
    setItems((a) => {
      const it = a.find((x) => x.id === id)!;
      const next = { ...it, ...p };
      const rest = a.filter((x) => x.id !== id);
      return p.layout && p.layout !== it.layout ? [...rest, next] : a.map((x) => (x.id === id ? next : x));
    });
    touch();
  };

  async function save() {
    setBusy(true);
    const templates = order.flatMap((l) => inCat(l).map((t, n) => ({ id: t.id, layout: t.layout, active: t.active, badge: t.badge, sort: order.indexOf(l) * 1000 + n })));
    const res = await fetch("/api/admin/templates/arrange", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: { order, hidden }, templates }) });
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      setMsg(es ? "✅ Guardado — ya se ve así en Crear" : "✅ Saved — Create page now shows this order");
      router.refresh();
    } else setMsg(es ? "❌ No se pudo guardar" : "❌ Couldn't save");
  }

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-bold">🗂️ {es ? "Ordenar categorías y estilos" : "Arrange categories & styles"}</h2>
        <p className="text-sm text-muted">
          {es
            ? "Usa ▲▼ para cambiar el orden en que aparecen en Crear. Oculta lo que no quieras mostrar y cambia un estilo de categoría con el selector."
            : "Use ▲▼ to change the order they appear on the Create page. Hide what you don't want shown, and move a style to another category with its selector."}
        </p>
      </div>

      <div className="space-y-2">
        {order.map((l, i) => {
          const a = art(l);
          const list = inCat(l);
          const catOn = !hidden.includes(l);
          const isOpen = open === l;
          return (
            <div key={l} className={`overflow-hidden rounded-xl border transition ${catOn ? "border-line bg-panel-2/60" : "border-dashed border-line/70 opacity-60"}`}>
              <div className="flex items-center gap-2 p-2.5">
                <div className="flex flex-col gap-1">
                  <Arrow dir="up" disabled={i === 0} onClick={() => moveCat(i, -1)} />
                  <Arrow dir="down" disabled={i === order.length - 1} onClick={() => moveCat(i, 1)} />
                </div>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(isOpen ? null : l)}>
                  <span className="text-2xl">{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{es ? a.es.name : a.en.name}</span>
                    <span className="block text-[11px] text-muted">
                      {list.filter((x) => x.active).length}/{list.length} {es ? "estilos visibles" : "styles shown"} · {isOpen ? "▾" : "▸"}
                    </span>
                  </span>
                </button>
                <Switch on={catOn} es={es} onChange={(v) => { setHidden(v ? hidden.filter((x) => x !== l) : [...hidden, l]); touch(); }} />
              </div>

              {isOpen && (
                <div className="space-y-1.5 border-t border-line bg-ink/40 p-2">
                  {list.length === 0 && <p className="p-2 text-xs text-muted">{es ? "Sin estilos en esta categoría." : "No styles in this category."}</p>}
                  {list.map((t, n) => (
                    <div key={t.id} className={`flex items-center gap-2 rounded-lg border p-1.5 ${t.active ? "border-line bg-panel" : "border-dashed border-line/60 opacity-55"}`}>
                      <div className="flex flex-col gap-1">
                        <Arrow dir="up" disabled={n === 0} onClick={() => moveTpl(l, n, -1)} />
                        <Arrow dir="down" disabled={n === list.length - 1} onClick={() => moveTpl(l, n, 1)} />
                      </div>
                      <div className="h-[70px] w-14 shrink-0 overflow-hidden rounded-md border border-line bg-panel-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.thumbUrl ? <img src={t.thumbUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-lg">{a.icon}</div>}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="truncate text-sm font-bold">{es ? t.nameEs || t.name : t.name}</div>
                        <div className="flex gap-1">
                          {([["", es ? "Sin etiqueta" : "No label"], ["recommended", es ? "⭐ Recomendado" : "⭐ Recommended"], ["fire", "🔥 Fire"]] as const).map(([v, lbl]) => (
                            <button key={v} type="button" onClick={() => patch(t.id, { badge: v || null })} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${(t.badge ?? "") === v ? (v === "fire" ? "border-orange-400 bg-orange-500/20 text-orange-300" : "border-lime bg-lime/15 text-lime") : "border-line text-muted"}`}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                        <select className="input w-full py-1 text-xs" value={t.layout} onChange={(e) => patch(t.id, { layout: e.target.value as LayoutKind })}>
                          {order.map((c) => (
                            <option key={c} value={c}>
                              {art(c).icon} {es ? art(c).es.name : art(c).en.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Switch on={t.active} es={es} onChange={(v) => patch(t.id, { active: v })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink/95 p-2 backdrop-blur">
        <button type="button" className="btn-primary px-6" disabled={!dirty || busy} onClick={save}>
          {busy ? "…" : es ? "Guardar orden" : "Save order"}
        </button>
        {dirty && !msg && <span className="text-xs text-muted">{es ? "Cambios sin guardar" : "Unsaved changes"}</span>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
