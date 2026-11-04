"use client";

import { useMemo, useState } from "react";
import { ART_TYPES } from "@/lib/pro-options";
import type { LayoutKind } from "@/lib/templates";
import { TemplateEditor, type AdminTemplate } from "./TemplateEditor";

/** Admin → Styles: every style grouped by category (in the admin's category order), with a search box. */
export function StyleGroups({ rows, order, es }: { rows: AdminTemplate[]; order: LayoutKind[]; es: boolean }) {
  const [q, setQ] = useState("");
  const [openAll, setOpenAll] = useState(false);
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const cats: LayoutKind[] = [...order, ...ART_TYPES.map((a) => a.layout).filter((l) => !order.includes(l))];
    return cats
      .map((layout) => {
        const art = ART_TYPES.find((a) => a.layout === layout);
        const items = rows
          .filter((r) => r.layout === layout)
          .filter((r) => !needle || `${r.name} ${r.nameEs} ${r.slug}`.toLowerCase().includes(needle))
          // Active styles first, each group in its display order.
          .sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort || a.name.localeCompare(b.name));
        return { layout, icon: art?.icon ?? "🖼️", name: es ? art?.es.name ?? layout : art?.en.name ?? layout, items, hidden: items.filter((r) => !r.active).length };
      })
      .filter((g) => g.items.length > 0);
  }, [rows, order, needle, es]);

  const total = rows.length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          enterKeyHint="search"
          className="input max-w-xs"
          placeholder={es ? `Buscar entre ${total} estilos…` : `Search ${total} styles…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => setOpenAll((v) => !v)}>
          {openAll ? (es ? "Cerrar todo" : "Collapse all") : es ? "Abrir todo" : "Expand all"}
        </button>
      </div>
      {groups.length === 0 && <p className="text-sm text-muted">{es ? "Nada coincide con tu búsqueda." : "Nothing matches your search."}</p>}
      {groups.map((g) => (
        <details key={g.layout + (openAll || !!needle ? "-o" : "-c")} open={openAll || !!needle} className="card group/cat overflow-hidden">
          <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-lg">{g.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{g.name}</span>
              <span className="block text-xs text-muted">
                {g.items.length} {es ? "estilos" : "styles"}
                {g.hidden ? ` · ${g.hidden} ${es ? "ocultos" : "hidden"}` : ""}
              </span>
            </span>
            <span className="text-muted transition group-open/cat:rotate-180">▾</span>
          </summary>
          <div className="space-y-2 border-t border-line bg-ink/30 p-3">
            {g.items.map((r) => (
              <TemplateEditor key={r.id} initial={r} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
