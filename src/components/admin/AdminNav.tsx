"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type AdminLink = { href: string; label: string; icon: string };
export type AdminGroup = { title: string; links: AdminLink[] };

/** Admin menu. Phones: one clean bar showing the current section — tap it for a grouped menu of tiles that
 *  drops over the page (nothing jumps around). Desktop: grouped sidebar. The current page is highlighted. */
export function AdminNav({ groups }: { groups: AdminGroup[] }) {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const all = groups.flatMap((g) => g.links);
  const cur = all.find((l) => on(l.href)) ?? all[0];
  const curGroup = groups.find((g) => g.links.some((l) => on(l.href)))?.title;

  return (
    <>
      {/* Phone */}
      <div className="relative md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left backdrop-blur transition ${open ? "border-lime/60 bg-panel" : "border-line bg-panel/80"}`}
          aria-expanded={open}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime/25 to-lime/5 text-xl ring-1 ring-lime/30">{cur?.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Admin{curGroup ? ` · ${curGroup}` : ""}</span>
            <span className="block truncate font-bold">{cur?.label}</span>
          </span>
          <span className={`grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted transition ${open ? "rotate-180 text-lime" : ""}`}>▾</span>
        </button>
        {open && (
          <>
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-[29] bg-black/55 backdrop-blur-[2px]" />
            <div className="kixo-fade-up absolute inset-x-0 top-full z-30 mt-2 max-h-[72vh] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]">
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.title}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted/90">{g.title}</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    {/* flex-wrap so the last row stretches — no empty holes */}
                    <div className="flex flex-wrap gap-2">
                      {g.links.map((l) => {
                        const active = on(l.href);
                        return (
                          <Link
                            key={l.href}
                            href={l.href}
                            className={`flex min-w-0 flex-1 basis-[30%] flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center text-[11px] font-bold leading-tight transition active:scale-95 ${
                              active ? "border-lime bg-lime/15 text-lime shadow-[0_0_24px_-8px_rgba(255,46,136,0.8)]" : "border-line bg-panel-2/60 text-white/85 hover:border-lime/40"
                            }`}
                          >
                            <span className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${active ? "bg-lime/20" : "bg-white/5"}`}>{l.icon}</span>
                            <span className="line-clamp-2">{l.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Desktop */}
      <nav className="hidden space-y-4 md:block">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted/70">{g.title}</div>
            {g.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${on(l.href) ? "bg-lime/10 text-lime" : "text-muted hover:bg-panel-2 hover:text-white"}`}
              >
                {on(l.href) && <span className="absolute top-1.5 bottom-1.5 left-0 w-1 rounded-full bg-lime" />}
                <span className="w-5 text-center">{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
