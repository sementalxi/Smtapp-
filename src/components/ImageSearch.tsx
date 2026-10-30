"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

interface Result {
  thumb: string;
  url: string;
  title: string;
  source: string;
}

/** Search the web for a player photo or crest, pick one, and it is copied to our storage. */
export function ImageSearch({
  kind,
  onPick,
  onClose,
  initial = "",
}: {
  kind: "photo" | "logo";
  onPick: (url: string) => void;
  onClose: () => void;
  initial?: string;
}) {
  const { locale } = useT();
  const es = locale === "es";
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (initial.trim().length >= 2) search(initial);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(term = q) {
    if (term.trim().length < 2) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/image-search?kind=${kind}&q=${encodeURIComponent(term.trim())}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setResults(data.results ?? []);
    else {
      setResults([]);
      setErr(data.error === "too_many_requests" ? (es ? "Demasiadas búsquedas, espera un poco" : "Too many searches, wait a bit") : es ? "La búsqueda falló, intenta de nuevo" : "Search failed, try again");
    }
  }

  async function pick(r: Result) {
    setPicking(r.url);
    setErr("");
    const res = await fetch("/api/upload/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: r.url, kind }),
    });
    const data = await res.json().catch(() => ({}));
    setPicking(null);
    if (data.url) {
      onPick(data.url);
      onClose();
      return;
    }
    const msg: Record<string, [string, string]> = {
      too_small: ["That image is too small — pick a bigger one", "Esa imagen es muy pequeña — elige otra más grande"],
      file_too_large: ["That image is too large", "Esa imagen es demasiado grande"],
      unsupported_type: ["That image format isn't supported", "Ese formato de imagen no es compatible"],
      unsafe_image: ["That image isn't allowed (sexual or graphic content) — pick another", "Esa imagen no está permitida (contenido sexual o violento) — elige otra"],
    };
    const known = msg[data.error as string];
    setErr(known ? known[es ? 1 : 0] : es ? "No se pudo descargar esa imagen — prueba otra" : "Couldn't get that image — try another one");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line p-3">
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <input
              ref={inputRef}
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={kind === "logo" ? (es ? "Nombre del equipo o torneo…" : "Team or competition name…") : es ? "Nombre del jugador…" : "Player name…"}
            />
            <button className="btn-primary shrink-0" disabled={busy || q.trim().length < 2}>
              {busy ? "…" : "🔍"}
            </button>
          </form>
          <button type="button" className="btn-ghost shrink-0 px-3" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto p-3">
          {err && <p className="mb-3 text-sm text-danger">{err}</p>}
          {results === null && !busy && (
            <p className="p-8 text-center text-sm text-muted">
              {kind === "logo"
                ? es ? "Escribe un equipo y elige su escudo." : "Type a team and pick its crest."
                : es ? "Escribe el nombre de un jugador y toca la foto que quieras." : "Type a player's name and tap the photo you want."}
            </p>
          )}
          {busy && <p className="p-8 text-center text-sm text-muted">{es ? "Buscando…" : "Searching…"}</p>}
          {results && !busy && results.length === 0 && !err && (
            <p className="p-8 text-center text-sm text-muted">{es ? "Sin resultados. Prueba con otro nombre." : "No results. Try a different name."}</p>
          )}
          {results && !busy && results.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {results.map((r) => (
                <button
                  key={r.url}
                  type="button"
                  disabled={!!picking}
                  onClick={() => pick(r)}
                  title={r.title}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-panel-2 transition hover:border-lime disabled:opacity-60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumb}
                    alt={r.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className={`h-full w-full ${kind === "logo" ? "object-contain p-2" : "object-cover"}`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== r.url) img.src = r.url;
                      else img.closest("button")?.remove();
                    }}
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-ink/80 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition group-hover:opacity-100">
                    {r.source}
                  </span>
                  {picking === r.url && <span className="absolute inset-0 grid place-items-center bg-ink/70 text-sm font-bold text-lime">…</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
          {es
            ? "Las fotos de internet pueden tener derechos de autor. Úsalas solo si tienes permiso."
            : "Photos from the web may be copyrighted. Only use ones you have permission to use."}
        </p>
      </div>
    </div>
  );
}
