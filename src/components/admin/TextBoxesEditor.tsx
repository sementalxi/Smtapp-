"use client";

import { useMemo, useState } from "react";
import { TEXT_SLOTS, allSlotsFor, overridesFrom, parseSlotOverrides, type SlotOverride, type SlotState } from "@/lib/text-slots";

/**
 * Admin → Styles: the text boxes of a flyer style. A box reaches the public creator only once it is ADDED here
 * (or with ➕ in the creator's admin panel); titles, the subtitle (grey example) and the AI placement can be
 * edited, and boxes can be created from the reference flyer or added by hand. Saved with the style.
 */
export function TextBoxesEditor({ slug, value, onChange, es, styleRefUrl }: { slug: string; value: string | null | undefined; onChange: (json: string | null) => void; es: boolean; styleRefUrl?: string | null }) {
  const rows = useMemo(() => allSlotsFor(slug, value), [slug, value]);
  const builtIn = (TEXT_SLOTS[slug] ?? []).length;
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  const commit = (next: SlotState[]) => {
    const ov = overridesFrom(next);
    onChange(ov.length ? JSON.stringify(ov) : null);
  };
  const patch = (key: string, p: Partial<SlotState>) => commit(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const add = () => commit([...rows, { key: `c${Date.now().toString(36)}`, on: true, label: es ? "Nueva línea" : "New line", labelEs: "Nueva línea", ph: "", where: "", max: 80, custom: true }]);
  const remove = (key: string) => commit(rows.filter((r) => r.key !== key));
  const reset = (key: string) => commit(rows.map((r) => (r.key === key && r.base ? { ...r, ...r.base, on: false } : r)));
  const added = rows.filter((r) => r.on).length;

  /** One tap: the AI reads the reference flyer and lists its text lines as candidate boxes (replaces earlier auto-created ones; built-in ones stay). */
  async function detect() {
    if (!styleRefUrl) return;
    setDetecting(true);
    setDetectMsg(null);
    try {
      const r = await fetch("/api/admin/templates/detect-slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ styleRefUrl }) });
      const d = (await r.json().catch(() => ({}))) as { slots?: SlotOverride[]; error?: string };
      if (!r.ok || !d.slots?.length) {
        setDetectMsg(d.error === "no_text_found" ? (es ? "No encontré líneas de texto en el flyer." : "No text lines found on the flyer.") : es ? "No se pudo leer el flyer. Inténtalo de nuevo." : "Couldn't read the flyer. Try again.");
        return;
      }
      const keep = rows.filter((r) => !r.custom);
      const found: SlotState[] = d.slots.map((s) => ({ key: s.key, on: false, label: s.label ?? "", labelEs: s.labelEs ?? s.label ?? "", ph: s.ph ?? "", where: s.where ?? "", max: s.max ?? 60, custom: true }));
      commit([...keep, ...found.filter((f) => !keep.some((k) => k.key === f.key))]);
      setDetectMsg(es ? `✅ ${found.length} cajas creadas desde el flyer — marca las que verá el público y guarda.` : `✅ ${found.length} boxes created from the flyer — tick the ones the public gets and save.`);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="rounded-xl border border-pink/40 bg-pink/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">📝 {es ? "Cajas de texto del estilo" : "This style's text boxes"}</div>
          <div className="text-xs text-muted">
            {es
              ? `Solo las cajas AÑADIDAS llegan al creador público. Cambia su título y subtítulo (el ejemplo gris), dile a la IA dónde va cada línea, créalas desde el flyer o añade las tuyas. ${added} de ${rows.length} añadidas${builtIn ? "" : " · este estilo no tiene líneas de flyer propias"}.`
              : `Only ADDED boxes reach the public creator. Rename each box's title and subtitle (the grey example), tell the AI where the line goes, create them from the flyer or add your own. ${added} of ${rows.length} added${builtIn ? "" : " · this style has no built-in flyer lines"}.`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {styleRefUrl && (
            <button type="button" onClick={detect} disabled={detecting} className="btn-primary text-xs">
              {detecting ? (es ? "⏳ Leyendo el flyer…" : "⏳ Reading the flyer…") : es ? "✨ Crear las cajas desde el flyer" : "✨ Create the boxes from the flyer"}
            </button>
          )}
          <button type="button" onClick={add} className="btn-ghost text-xs">
            ➕ {es ? "Añadir caja propia" : "Add my own box"}
          </button>
        </div>
      </div>
      {!styleRefUrl && (
        <p className="mt-2 text-[11px] text-muted">{es ? "Sube una referencia de estilo arriba y podrás crear las cajas automáticamente desde el flyer." : "Add a Pro AI style reference above and the boxes can be created automatically from the flyer."}</p>
      )}
      {detectMsg && <p className="mt-2 text-xs">{detectMsg}</p>}
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.key} className={`rounded-lg border p-2 ${r.on ? "border-lime/40 bg-panel/60" : "border-line/50 bg-panel/30"}`}>
              <div className="flex items-start gap-2">
                <label className="mt-1 flex shrink-0 items-center gap-1 text-[11px] font-bold">
                  <input type="checkbox" checked={r.on} onChange={(e) => patch(r.key, { on: e.target.checked })} />
                  {r.on ? (es ? "✅ Añadida" : "✅ Added") : es ? "➕ Añadir" : "➕ Add"}
                </label>
                <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                  <input className="input !py-1.5 text-xs" placeholder={es ? "Título (EN)" : "Title (EN)"} value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} maxLength={60} />
                  <input className="input !py-1.5 text-xs" placeholder={es ? "Título (ES)" : "Title (ES)"} value={r.labelEs} onChange={(e) => patch(r.key, { labelEs: e.target.value })} maxLength={60} />
                  <input className="input !py-1.5 text-xs" placeholder={es ? "Subtítulo / ejemplo" : "Subtitle / example"} value={r.ph ?? ""} onChange={(e) => patch(r.key, { ph: e.target.value })} maxLength={120} />
                  <input className="input !py-1.5 text-xs" placeholder={es ? "Para la IA — dónde va y cómo se escribe" : "For the AI — where it goes and how it's lettered"} value={r.where} onChange={(e) => patch(r.key, { where: e.target.value })} maxLength={400} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {r.custom ? (
                    <button type="button" onClick={() => remove(r.key)} className="rounded-md border border-red-500/40 px-2 py-1 text-[11px] text-red-300">
                      🗑
                    </button>
                  ) : (
                    <button type="button" onClick={() => reset(r.key)} title={es ? "Volver a lo de fábrica" : "Back to the built-in box"} className="rounded-md border border-line px-2 py-1 text-[11px] text-muted">
                      ↺
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
