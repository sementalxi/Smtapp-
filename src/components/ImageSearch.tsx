"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

interface Result {
  thumb: string;
  url: string;
  title: string;
  source: string;
  w?: number;
  h?: number;
}

/** "HD" badge text for a result whose size is known. */
const sizeTag = (r: Result) => (r.w && r.h ? (Math.min(r.w, r.h) >= 1400 ? "4K" : Math.min(r.w, r.h) >= 900 ? "HD" : `${r.w}×${r.h}`) : "");

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
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [lastQ, setLastQ] = useState("");
  const [src, setSrc] = useState<"web" | "pinterest">("web");
  const [preview, setPreview] = useState<Result | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (preview ? setPreview(null) : onClose());
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    if (initial.trim().length >= 2) search(initial);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(term = q, source = src) {
    if (term.trim().length < 2) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/image-search?kind=${kind}&src=${source}&q=${encodeURIComponent(term.trim())}`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setResults(data.results ?? []);
      setPage(1);
      setLastQ(term.trim());
      setMore(data.provider !== "free" && (data.results ?? []).length >= 10);
      if (data.providerError) setErr(`⚠️ Admin: ${data.providerError}`);
      else if (!(data.results ?? []).length) setErr(es ? "Sin resultados — prueba otro nombre" : "No results — try another name");
    }
    else {
      setResults([]);
      setErr(data.error === "too_many_requests" ? (es ? "Demasiadas búsquedas, espera un poco" : "Too many searches, wait a bit") : es ? "La búsqueda falló, intenta de nuevo" : "Search failed, try again");
    }
  }

  async function loadMore() {
    setMoreBusy(true);
    const next = page + 1;
    const res = await fetch(`/api/image-search?kind=${kind}&src=${src}&page=${next}&q=${encodeURIComponent(lastQ)}`);
    const data = await res.json().catch(() => ({}));
    setMoreBusy(false);
    const fresh: Result[] = data.results ?? [];
    setResults((cur) => {
      const seen = new Set((cur ?? []).map((x) => x.url));
      return [...(cur ?? []), ...fresh.filter((x) => !seen.has(x.url))];
    });
    setPage(next);
    setMore(res.ok && fresh.length >= 10 && next < 10);
  }

  async function pick(r: Result) {
    setPicking(r.url);
    setErr("");
    const res = await fetch("/api/upload/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: r.url, thumb: r.thumb, kind }),
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
    setErr(
      known
        ? known[es ? 1 : 0]
        : es
          ? "Ese sitio bloquea la descarga de la foto — prueba otro resultado, o guárdala en tu teléfono y súbela."
          : "That site blocks downloading the photo — try another result, or save it to your phone and upload it.",
    );
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
              type="search"
              enterKeyHint="search"
              autoComplete="off"
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
        <div className="flex gap-2 border-b border-line px-3 py-2">
          {([
            ["web", "🔎 Google"],
            ["pinterest", "📌 Pinterest"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSrc(id);
                if (q.trim().length >= 2) search(q, id);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${src === id ? (id === "pinterest" ? "border-[#E60023] bg-[#E60023] text-white" : "border-lime bg-lime text-ink") : "border-line text-muted"}`}
            >
              {label}
            </button>
          ))}
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
          {busy && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="skeleton block aspect-[3/4] w-full" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          )}
          {results && !busy && results.length === 0 && !err && (
            <p className="p-8 text-center text-sm text-muted">{es ? "Sin resultados. Prueba con otro nombre." : "No results. Try a different name."}</p>
          )}
          {results && !busy && results.length > 0 && (
            <div className={`grid gap-2 ${kind === "logo" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
              {results.map((r) => (
                <button
                  key={r.url}
                  type="button"
                  disabled={!!picking}
                  onClick={() => (kind === "logo" ? pick(r) : setPreview(r))}
                  title={r.title}
                  className={`group relative overflow-hidden rounded-xl border border-line bg-panel-2 transition hover:border-lime active:scale-[0.98] disabled:opacity-60 ${kind === "logo" ? "aspect-square" : "aspect-[3/4]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumb}
                    alt={r.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className={`h-full w-full ${kind === "logo" ? "object-contain p-2" : "object-cover object-top"}`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== r.url) img.src = r.url;
                      else img.closest("button")?.remove();
                    }}
                  />
                  {kind === "photo" && sizeTag(r) && (
                    <span className={`absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black ${/HD|4K/.test(sizeTag(r)) ? "bg-lime text-ink" : "bg-ink/80 text-white/80"}`}>{sizeTag(r)}</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/90 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] text-white/70">
                    {r.source}
                  </span>
                  {picking === r.url && <span className="absolute inset-0 grid place-items-center bg-ink/70 text-sm font-bold text-lime">…</span>}
                </button>
              ))}
            </div>
          )}
          {results && !busy && results.length > 0 && more && (
            <button type="button" onClick={loadMore} disabled={moreBusy} className="mt-3 w-full rounded-xl border border-line bg-panel-2 py-3 text-sm font-bold text-lime transition hover:border-lime/50">
              {moreBusy ? (es ? "Cargando…" : "Loading…") : es ? "Cargar más" : "Load more"}
            </button>
          )}
        </div>
        <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
          {es
            ? "Las fotos de internet pueden tener derechos de autor. Úsalas solo si tienes permiso."
            : "Photos from the web may be copyrighted. Only use ones you have permission to use."}
        </p>
      </div>

      {/* Preview: see the full photo before using it */}
      {preview && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={() => setPreview(null)}>
          <div className="flex items-center justify-between gap-3 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{preview.title || (es ? "Foto" : "Photo")}</div>
              <div className="truncate text-[11px] text-muted">
                {preview.source}
                {preview.w && preview.h ? ` · ${preview.w}×${preview.h}` : ""}
              </div>
            </div>
            <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setPreview(null)} aria-label="Close">✕</button>
          </div>
          <div className="min-h-0 flex-1 px-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={preview.title}
              referrerPolicy="no-referrer"
              className="mx-auto h-full w-auto max-w-full rounded-xl object-contain"
              onError={(e) => {
                if (e.currentTarget.src !== preview.thumb) e.currentTarget.src = preview.thumb;
              }}
            />
          </div>
          <div className="flex gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn-ghost flex-1 py-3" onClick={() => setPreview(null)}>
              ‹ {es ? "Otra" : "Back"}
            </button>
            <button
              type="button"
              className="btn-primary flex-[2] py-3"
              disabled={!!picking}
              onClick={async () => {
                const r = preview;
                await pick(r);
              }}
            >
              {picking ? (es ? "Guardando…" : "Saving…") : es ? "✓ Usar esta foto" : "✓ Use this photo"}
            </button>
          </div>
          {err && <p className="px-3 pb-3 text-center text-sm text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}
