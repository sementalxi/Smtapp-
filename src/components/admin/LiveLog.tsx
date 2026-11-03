"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Row = { id: string; source: string; level: string; kind: string; message: string; at: string };

/** Admin: live activity of the website and the Discord bot (updates every 3 seconds). */
export function LiveLog({ es }: { es: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState("");
  const [onlyErr, setOnlyErr] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const newest = useRef<string>("");

  const q = `source=${source}&level=${onlyErr ? "error" : ""}`;
  const loadAll = useCallback(async () => {
    const d = await fetch(`/api/admin/logs?${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!d) return;
    setRows(d.rows);
    newest.current = d.rows[0]?.at ?? new Date().toISOString();
  }, [q]);
  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/admin/logs?${q}&after=${encodeURIComponent(newest.current ?? "")}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      if (!d?.rows?.length) return;
      newest.current = d.rows[0].at;
      setFresh(new Set(d.rows.map((r: Row) => r.id)));
      setRows((old) => [...d.rows, ...old].slice(0, 300));
    }, 3000);
    return () => clearInterval(t);
  }, [paused, q]);

  const color = (r: Row) => (r.level === "error" ? "border-danger/50 bg-danger/5" : r.level === "warn" ? "border-amber-400/40 bg-amber-400/5" : "border-line bg-panel/60");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {([["", es ? "Todo" : "All"], ["site", "🌐 Web"], ["bot", "🤖 Bot"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSource(k)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${source === k ? "border-lime bg-lime/15 text-lime" : "border-line text-muted"}`}>{l}</button>
        ))}
        <button type="button" onClick={() => setOnlyErr((v) => !v)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${onlyErr ? "border-danger bg-danger/15 text-danger" : "border-line text-muted"}`}>⚠️ {es ? "Solo errores" : "Errors only"}</button>
        <button type="button" onClick={() => setPaused((v) => !v)} className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-muted" : "animate-pulse bg-emerald-400"}`} />
          {paused ? (es ? "Pausado" : "Paused") : es ? "En vivo" : "Live"}
        </button>
      </div>
      {rows.length === 0 && <p className="card p-6 text-center text-sm text-muted">{es ? "Aún no hay actividad. Aparecerá aquí en vivo." : "No activity yet. It will show up here live."}</p>}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-xl border px-3 py-2 transition ${color(r)} ${fresh.has(r.id) ? "kixo-fade-up ring-1 ring-lime/40" : ""}`}>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
              <span className={`rounded px-1.5 py-0.5 ${r.source === "bot" ? "bg-[#5865F2]/25 text-[#a5b0ff]" : "bg-lime/15 text-lime"}`}>{r.source === "bot" ? "🤖 Bot" : "🌐 Web"}</span>
              <span>{r.kind.replace(/_/g, " ")}</span>
              <span className="ml-auto normal-case tracking-normal">{new Date(r.at).toLocaleString(es ? "es" : "en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
            </div>
            <div className="mt-0.5 break-words text-sm text-white/90">{r.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
