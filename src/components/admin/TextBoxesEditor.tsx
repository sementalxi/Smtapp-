"use client";

import { useMemo, useState } from "react";
import { TEXT_SLOTS, parseSlotOverrides, type SlotOverride, type TextSlot } from "@/lib/text-slots";

/** One editable row: the style's built-in box (if any) plus the admin's changes. */
type Row = { key: string; base?: TextSlot; on: boolean; label: string; labelEs: string; ph: string; where: string; custom: boolean };

function rowsFor(slug: string, json: string | null | undefined): Row[] {
  const base = TEXT_SLOTS[slug] ?? [];
  const ov = parseSlotOverrides(json);
  const byKey = new Map(ov.map((o) => [o.key, o]));
  const rows: Row[] = base.map((b) => {
    const o = byKey.get(b.key);
    return { key: b.key, base: b, on: o?.on !== false, label: o?.label ?? "", labelEs: o?.labelEs ?? "", ph: o?.ph ?? "", where: o?.where ?? "", custom: false };
  });
  for (const o of ov) if (o.custom && !base.some((b) => b.key === o.key)) rows.push({ key: o.key, on: o.on !== false, label: o.label ?? "", labelEs: o.labelEs ?? "", ph: o.ph ?? "", where: o.where ?? "", custom: true });
  return rows;
}

/** Back to the stored form: only what differs from the built-in box, plus the admin's own boxes in full. */
function toOverrides(rows: Row[]): SlotOverride[] {
  const out: SlotOverride[] = [];
  for (const r of rows) {
    if (r.custom) {
      out.push({ key: r.key, custom: true, on: r.on, label: r.label.trim(), labelEs: r.labelEs.trim(), ph: r.ph.trim(), where: r.where.trim() });
      continue;
    }
    const o: SlotOverride = { key: r.key };
    if (!r.on) o.on = false;
    if (r.label.trim()) o.label = r.label.trim();
    if (r.labelEs.trim()) o.labelEs = r.labelEs.trim();
    if (r.ph.trim()) o.ph = r.ph.trim();
    if (r.where.trim()) o.where = r.where.trim();
    if (Object.keys(o).length > 1) out.push(o);
  }
  return out;
}

/**
 * Admin → Styles: the text boxes a flyer style shows in the creator. Tick which boxes the public sees,
 * rename each box's title / subtitle (the example shown in the empty box), tell the AI where the line
 * goes, and add boxes of your own. Saved with the style (Template.textSlots).
 */
export function TextBoxesEditor({ slug, value, onChange, es, styleRefUrl }: { slug: string; value: string | null | undefined; onChange: (json: string | null) => void; es: boolean; styleRefUrl?: string | null }) {
  const rows = useMemo(() => rowsFor(slug, value), [slug, value]);
  const builtIn = (TEXT_SLOTS[slug] ?? []).length;
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  /** One tap: the AI reads the reference flyer and creates one box per text line (replaces the admin-added boxes; built-in ones stay). */
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
      const found: Row[] = d.slots.map((s) => ({ key: s.key, on: true, label: s.label ?? "", labelEs: s.labelEs ?? "", ph: s.ph ?? "", where: s.where ?? "", custom: true }));
      commit([...keep, ...found.filter((f) => !keep.some((k) => k.key === f.key))]);
      setDetectMsg(es ? `✅ ${found.length} cajas creadas desde el flyer — revisa y guarda.` : `✅ ${found.length} boxes created from the flyer — check them and save.`);
    } finally {
      setDetecting(false);
    }
  }
  const commit = (next: Row[]) => {
    const ov = toOverrides(next);
    onChange(ov.length ? JSON.stringify(ov) : null);
  };
  const patch = (key: string, p: Partial<Row>) => commit(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const add = () => commit([...rows, { key: `c${Date.now().toString(36)}`, on: true, label: "", labelEs: "", ph: "", where: "", custom: true }]);
  const remove = (key: string) => commit(rows.filter((r) => r.key !== key));
  const reset = (key: string) => commit(rows.map((r) => (r.key === key ? { ...r, on: true, label: "", labelEs: "", ph: "", where: "" } : r)));
  const shown = rows.filter((r) => r.on).length;

  return (
    <div className="rounded-xl border border-pink/40 bg-pink/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold">📝 {es ? "Cajas de texto del estilo" : "This style's text boxes"}</div>
          <div className="text-xs text-muted">
            {es
              ? `Marca las que ve el público, cambia su título y subtítulo (el ejemplo gris), dile a la IA dónde va cada línea, o añade cajas nuevas. ${shown} de ${rows.length} visibles${builtIn ? "" : " · este estilo no tiene líneas de flyer propias — añade las tuyas"}.`
              : `Tick the boxes the public sees, rename each box's title and subtitle (the grey example), tell the AI where the line goes, or add boxes of your own. ${shown} of ${rows.length} shown${builtIn ? "" : " · this style has no built-in flyer lines — add your own"}.`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {styleRefUrl && (
            <button type="button" onClick={detect} disabled={detecting} className="btn-primary text-xs">
              {detecting ? (es ? "⏳ Leyendo el flyer…" : "⏳ Reading the flyer…") : es ? "✨ Crear las cajas desde el flyer" : "✨ Create the boxes from the flyer"}
            </button>
          )}
          <button type="button" onClick={add} className="btn-ghost text-xs">
            ➕ {es ? "Añadir caja" : "Add box"}
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
            <div key={r.key} className={`rounded-lg border p-2 ${r.on ? "border-line bg-panel/60" : "border-line/50 bg-panel/30 opacity-70"}`}>
              <div className="flex items-start gap-2">
                <label className="mt-1 flex shrink-0 items-center gap-1 text-[11px] font-bold">
                  <input type="checkbox" checked={r.on} onChange={(e) => patch(r.key, { on: e.target.checked })} />
                  {es ? "Mostrar" : "Show"}
                </label>
                <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                  <input className="input !py-1.5 text-xs" placeholder={(es ? "Título (EN): " : "Title (EN): ") + (r.base?.label ?? "")} value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} maxLength={60} />
                  <input className="input !py-1.5 text-xs" placeholder={(es ? "Título (ES): " : "Title (ES): ") + (r.base?.labelEs ?? "")} value={r.labelEs} onChange={(e) => patch(r.key, { labelEs: e.target.value })} maxLength={60} />
                  <input className="input !py-1.5 text-xs" placeholder={(es ? "Subtítulo / ejemplo: " : "Subtitle / example: ") + (r.base?.ph ?? "")} value={r.ph} onChange={(e) => patch(r.key, { ph: e.target.value })} maxLength={120} />
                  <input className="input !py-1.5 text-xs" placeholder={(es ? "Para la IA — dónde va y cómo se escribe: " : "For the AI — where it goes and how it's lettered: ") + (r.base?.where ?? "")} value={r.where} onChange={(e) => patch(r.key, { where: e.target.value })} maxLength={400} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {r.custom ? (
                    <button type="button" onClick={() => remove(r.key)} className="rounded-md border border-red-500/40 px-2 py-1 text-[11px] text-red-300">
                      🗑
                    </button>
                  ) : (
                    (r.label || r.labelEs || r.ph || r.where || !r.on) && (
                      <button type="button" onClick={() => reset(r.key)} title={es ? "Volver a lo de fábrica" : "Back to the built-in box"} className="rounded-md border border-line px-2 py-1 text-[11px] text-muted">
                        ↺
                      </button>
                    )
                  )}
                </div>
              </div>
              {r.base && (
                <div className="mt-1 truncate text-[10px] text-muted" title={r.base.where}>
                  {es ? "De fábrica: " : "Built in: "}
                  <b>{es ? r.base.labelEs : r.base.label}</b> · {r.base.ph} · {r.base.where}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
