"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: keyof typeof ICONS; admin?: boolean };

const ICONS = {
  create: <path d="M12 5v14M5 12h14" />,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pricing: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />,
  admin: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6zM9 12l2 2 4-4" />,
};

const Icon = ({ name, className = "" }: { name: keyof typeof ICONS; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {ICONS[name]}
  </svg>
);

/** Main navigation: pill tabs on desktop, an icon tab bar on phones. Highlights the current page. */
export function NavLinks({ items, variant }: { items: Item[]; variant: "desktop" | "mobile" }) {
  const path = usePathname() || "/";
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  if (variant === "desktop") {
    return (
      <nav className="ml-5 hidden items-center gap-1 rounded-full border border-line bg-panel/70 p-1 text-sm font-semibold md:flex">
        {items.map((it) => {
          const on = active(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${
                on ? "bg-lime text-ink shadow-[0_0_18px_-6px_rgba(183,255,69,0.8)]" : it.admin ? "text-teal hover:bg-panel-2 hover:text-white" : "text-muted hover:bg-panel-2 hover:text-white"
              }`}
            >
              <Icon name={it.icon} className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="border-t border-line bg-ink/90 px-2 py-1.5 md:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const on = active(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                on ? "bg-lime/10 text-lime" : it.admin ? "text-teal" : "text-muted active:bg-panel-2"
              }`}
            >
              <Icon name={it.icon} className="h-5 w-5" />
              {it.label}
              {on && <span className="absolute -bottom-1.5 h-0.5 w-8 rounded-full bg-lime shadow-[0_0_10px_rgba(183,255,69,0.9)]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
