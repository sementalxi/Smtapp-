"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";

type P = { id: string; url: string; title: string; at: string; test: boolean };

/** Admin only: the latest posters made with the chosen style, so you see what the AI did with it before using it. */
export function RecentWithStyle({ templateId, styleName }: { templateId: string; styleName: string }) {
  const { locale } = useT();
  const es = locale === "es";
  const [posters, setPosters] = useState<P[] | null>(null);
  useEffect(() => {
    let stop = false;
    setPosters(null);
    fetch(`/api/admin/templates/${templateId}/recent`)
      .then((r) => (r.ok ? r.json() : { posters: [] }))
      .then((d: { posters?: P[] }) => !stop && setPosters(d.posters ?? []))
      .catch(() => !stop && setPosters([]));
    return () => {
      stop = true;
    };
  }, [templateId]);
  if (posters && posters.length === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-line p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
        🕘 {es ? `Admin · lo último hecho con "${styleName}"` : `Admin · latest made with "${styleName}"`}
      </div>
      {!posters ? (
        <div className="h-28 animate-pulse rounded-lg bg-panel-2" />
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {posters.map((p) => (
            <Link key={p.id} href={`/banner/${p.id}`} target="_blank" className="relative shrink-0" title={`${p.title} · ${new Date(p.at).toLocaleString()}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-36 w-auto rounded-lg border border-line object-cover" loading="lazy" decoding="async" />
              {p.test && <span className="absolute left-1 top-1 rounded bg-ink/80 px-1 text-[9px] font-black uppercase text-white">🧪 test</span>}
            </Link>
          ))}
        </div>
      )}
      <p className="mt-1 text-[10px] text-muted">{es ? "Toca uno para abrirlo. Solo los admins ven esto." : "Tap one to open it. Only admins see this."}</p>
    </div>
  );
}
