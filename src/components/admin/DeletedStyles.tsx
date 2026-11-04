"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin: the bin — styles that were deleted but had posters (restorable). */
export function DeletedStyles({ items, es }: { items: { id: string; name: string; nameEs: string; layout: string; uses: number }[]; es: boolean }) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const list = items.filter((i) => !gone.includes(i.id));
  if (!list.length) return null;
  async function restore(id: string) {
    setBusy(id);
    const r = await fetch(`/api/admin/templates/${id}/restore`, { method: "POST" });
    setBusy("");
    if (r.ok) {
      setGone((g) => [...g, id]);
      router.refresh();
    }
  }
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-bold text-muted">
        🗑️ {es ? `Estilos eliminados (${list.length})` : `Deleted styles (${list.length})`}
        <span className="ml-2 text-xs font-normal">{es ? "— se guardan porque tienen pósters; puedes restaurarlos" : "— kept because posters were made with them; you can restore them"}</span>
      </summary>
      <ul className="mt-3 divide-y divide-line text-sm">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate">
              <b>{i.name}</b> <span className="text-muted">/ {i.nameEs} · {i.layout} · {i.uses} {es ? "usos" : "uses"}</span>
            </span>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={busy === i.id} onClick={() => restore(i.id)}>
              {busy === i.id ? "…" : es ? "Restaurar" : "Restore"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
