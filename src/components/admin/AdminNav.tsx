"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminLink = { href: string; label: string; icon: string };
export type AdminGroup = { title: string; links: AdminLink[] };

/** Admin menu: grouped list on desktop, one scrollable row of icon pills on phones. The current page is highlighted. */
export function AdminNav({ groups }: { groups: AdminGroup[] }) {
  const path = usePathname() || "";
  const on = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <>
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 md:hidden">
        {groups.flatMap((g) => g.links).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${on(l.href) ? "border-lime bg-lime text-ink" : "border-line bg-panel/70 text-muted"}`}
          >
            <span>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
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
