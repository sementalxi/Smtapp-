"use client";
import { useEffect, useRef, useState } from "react";

export type XboxPick = { xuid: string; gamertag: string; pic: string; gamerscore: string };

/** Type a gamertag → matching Xbox profiles (gamerpic, gamerscore) → "That's me". */
export function XboxSearch({ es, value, onText, onPick, picked }: { es: boolean; value: string; onText: (v: string) => void; onPick: (p: XboxPick | null) => void; picked: XboxPick | null }) {
  const [results, setResults] = useState<XboxPick[]>([]);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (picked && picked.gamertag === value) return;
    if (t.current) clearTimeout(t.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    t.current = setTimeout(async () => {
      setBusy(true);
      setErr("");
      try {
        const r = await fetch(`/api/xbox/search?q=${encodeURIComponent(value.trim())}`, { cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { ready?: boolean; results?: XboxPick[]; error?: string };
        setReady(d.ready !== false);
        setResults(d.results ?? []);
        if (d.error) setErr(es ? "La búsqueda de Xbox no responde ahora — puedes escribirlo igual." : "Xbox search isn't answering right now — you can just type it.");
      } finally {
        setBusy(false);
      }
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <input
        className="input"
        maxLength={32}
        autoComplete="off"
        placeholder={es ? "Busca tu gamertag de Xbox" : "Search your Xbox gamertag"}
        value={value}
        onChange={(e) => {
          onText(e.target.value.replace(/[^\p{L}\p{N} _.\-#]/gu, ""));
          if (picked) onPick(null);
        }}
      />
      {picked ? (
        <div className="flex items-center gap-3 rounded-xl border border-lime/60 bg-lime/10 p-2">
          {picked.pic ? <img src={picked.pic} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-panel-2">🎮</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">✅ {picked.gamertag}</p>
            <p className="text-[11px] text-muted">{es ? "Cuenta de Xbox confirmada" : "Xbox account confirmed"}{picked.gamerscore ? ` · ${picked.gamerscore} G` : ""}</p>
          </div>
          <button type="button" className="text-xs underline text-muted" onClick={() => onPick(null)}>{es ? "Cambiar" : "Change"}</button>
        </div>
      ) : (
        ready &&
        value.trim().length >= 2 && (
          <div className="space-y-1.5">
            {busy && <p className="text-[11px] text-muted">{es ? "Buscando en Xbox…" : "Searching Xbox…"}</p>}
            {!busy && !results.length && !err && <p className="text-[11px] text-muted">{es ? "No encontramos ese gamertag en Xbox. Revisa cómo se escribe." : "No Xbox account found with that gamertag. Check the spelling."}</p>}
            {err && <p className="text-[11px] text-amber-200">{err}</p>}
            {results.map((r) => (
              <button key={r.xuid} type="button" onClick={() => { onText(r.gamertag); onPick(r); }} className="flex w-full items-center gap-3 rounded-xl border border-line p-2 text-left hover:border-lime/60">
                {r.pic ? <img src={r.pic} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-panel-2">🎮</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{r.gamertag}</span>
                  {r.gamerscore && <span className="block text-[11px] text-muted">{r.gamerscore} G</span>}
                </span>
                <span className="text-xs font-bold text-lime">{es ? "Soy yo" : "That's me"}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
