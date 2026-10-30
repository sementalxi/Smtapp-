"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PATHS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  create: <path d="M12 5v14M5 12h14" />,
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  credits: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5v1.5M12 16v1.5" />
    </>
  ),
  invite: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M18 8v6M15 11h6" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" />
    </>
  ),
};

export type AccountLink = { href: string; label: string; icon: keyof typeof PATHS; badge?: string };

const Icon = ({ name }: { name: keyof typeof PATHS }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden>
    {PATHS[name]}
  </svg>
);

/** Account menu: vertical list on desktop, scrollable chips on phones. */
export function AccountNav({ links, variant }: { links: AccountLink[]; variant: "side" | "chips" }) {
  const path = usePathname() || "";
  const on = (href: string) => path === href || path.startsWith(href + "/");

  if (variant === "chips") {
    return (
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
              on(l.href) ? "border-lime bg-lime text-ink" : "border-line bg-panel/70 text-muted"
            }`}
          >
            <Icon name={l.icon} />
            {l.label}
            {l.badge && <span className={`rounded-full px-1.5 text-[9px] ${on(l.href) ? "bg-ink/20" : "bg-teal/20 text-teal"}`}>{l.badge}</span>}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {links.map((l) => {
        const a = on(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              a ? "bg-lime/10 text-lime" : "text-muted hover:bg-panel-2 hover:text-white"
            }`}
          >
            {a && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-lime shadow-[0_0_10px_rgba(183,255,69,0.8)]" />}
            <Icon name={l.icon} />
            <span className="flex-1">{l.label}</span>
            {l.badge && <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-bold text-teal">{l.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
