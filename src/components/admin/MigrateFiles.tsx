"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

/** Admin: move old images from the database into Vercel Blob (runs in batches with a progress bar). */
export function MigrateFiles() {
  const { locale } = useT();
  const es = locale === "es";
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [blob, setBlob] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/migrate-files")
      .then((r) => r.json())
      .then((d) => {
        setRemaining(d.remaining ?? 0);
        setTotal(d.remaining ?? 0);
        setBlob(!!d.blob);
      })
      .catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setMsg("");
    let left = remaining ?? 0;
    let stuck = 0;
    while (left > 0) {
      const r = await fetch("/api/admin/migrate-files", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(`❌ ${d.detail || d.error || "error"}`);
        break;
      }
      left = d.remaining;
      setRemaining(left);
      if (!d.moved) stuck++;
      if (stuck >= 2) {
        setMsg(es ? `⚠️ ${left} archivos no se pudieron mover` : `⚠️ ${left} files couldn't be moved`);
        break;
      }
    }
    if (left === 0) setMsg(es ? "✅ ¡Listo! Todas las imágenes están en Blob." : "✅ Done! All images are in Blob now.");
    setBusy(false);
  }

  if (remaining === null || (remaining === 0 && !msg)) return null;
  const pct = total ? Math.round(((total - remaining) / total) * 100) : 100;

  return (
    <div className="card max-w-xl space-y-3 p-5">
      <h2 className="text-lg font-bold">📦 {es ? "Mover imágenes antiguas a Blob" : "Move old images to Blob"}</h2>
      <p className="text-sm text-muted">
        {es
          ? `Hay ${remaining} imágenes guardadas dentro de la base de datos. Muévelas a Vercel Blob para que la base de datos quede ligera y rápida. Los enlaces se actualizan solos — nada se rompe.`
          : `${remaining} images are still stored inside the database. Move them to Vercel Blob so the database stays small and fast. All links update automatically — nothing breaks.`}
      </p>
      {busy || pct < 100 ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-lime transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary px-6" disabled={busy || !blob || remaining === 0} onClick={run}>
          {busy ? `${es ? "Moviendo" : "Moving"}… ${pct}%` : es ? "Mover ahora" : "Move now"}
        </button>
        {!blob && <span className="text-xs text-danger">{es ? "Blob no está conectado" : "Blob isn't connected"}</span>}
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      {busy && <p className="text-[11px] text-muted">{es ? "Deja esta página abierta hasta que termine." : "Keep this page open until it finishes."}</p>}
    </div>
  );
}
