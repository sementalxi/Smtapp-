"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type AdminLink = { href: string; label: string; icon: string };
export type AdminGroup = { title: string; links: AdminLink[] };

/** Admin menu. Phones: one clean bar showing the current section — tap it for a grouped menu of tiles.
 *  Desktop: grouped sidebar. The current page is highlighted. */
export function AdminNav({ groups }: { groups: AdminGroup[] }) {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const all = groups.flatMap((g) => g.links);
  const cur = all.find((l) => on(l.href)) ?? all[0];
  return (
    <>
      {/* Phone */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel/80 px-4 py-3 text-left backdrop-blur"
          aria-expanded={open}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime/15 text-lg">{cur?.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Admin</span>
            <span className="block truncate font-bold">{cur?.label}</span>
          </span>
          <span className={`text-muted transition ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        {open && (
          <div className="mt-2 space-y-3 rounded-2xl border border-line bg-panel p-3 shadow-2xl">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-muted/80">{g.title}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {g.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center text-[11px] font-bold leading-tight transition active:scale-95 ${on(l.href) ? "border-lime bg-lime/15 text-lime" : "border-line bg-panel-2/60 text-white/85"}`}
                    >
                      <span className="text-xl">{l.icon}</span>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
