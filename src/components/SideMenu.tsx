"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const P = {
  create: <path d="M12 5v14M5 12h14" />,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  team: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c.5-3.3 3-5.2 6-5.2s5.5 1.9 6 5.2M15.5 14.6c2.6.1 4.6 1.8 5 4.6" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pricing: <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" />,
  credits: <><circle cx="12" cy="12" r="9" /><path d="M13 7 9 13h3l-1 4 4-6h-3z" /></>,
  invite: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zm0 0c1.5-3 5-4 5-1.5S14 8 12 8z" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" /></>,
  admin: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6zM9 12l2 2 4-4" />,
  deals: <><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8" /><path d="M2 7h20v5H2zM12 21V7" /></>,
};
type IconName = keyof typeof P;
export type MenuItem = { href: string; label: string; icon: IconName; badge?: string; badgeStyle?: "lime" | "teal" | "button"; primary?: boolean };

const Icon = ({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
    {P[name]}
  </svg>
);

/** Hamburger button + slide-in side menu. */
export function SideMenu({
  items,
  footer,
  site,
}: {
  items: MenuItem[];
  site: string;
  footer: { loggedIn: boolean; title: string; text: string; cta: string; ctaHref: string; credits?: number; name?: string; email?: string };
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const path = usePathname() || "/";

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = (href: string) => (href === "/" ? path === "/" : path === href.split("?")[0] && !href.includes("?"));

  return (
    <>
      <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-white transition hover:border-lime/60 hover:text-lime sm:h-10 sm:w-10">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h10M4 17h16" />
        </svg>
      </button>

      {mounted && createPortal(
      <div className={`fixed inset-0 z-[70] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <aside
          role="dialog"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col border-r border-line bg-[#0b100d] shadow-[30px_0_80px_-20px_rgba(0,0,0,0.9)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-lime/10 blur-3xl" />
          <div className="relative flex items-center justify-between border-b border-line px-5 py-4">
            <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kixo-hero-logo.webp" alt="" className="h-9 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kixo-logo.png" alt={site} className="h-6 w-auto" />
            </Link>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {items.map((it, i) => {
              const on = active(it.href);
              return (
                <Link
                  key={it.href + it.label}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${60 + i * 35}ms` : "0ms" }}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[17px] font-semibold transition-all duration-300 ${open ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"} ${
                    it.primary
                      ? "border border-lime/30 bg-gradient-to-r from-lime/15 to-transparent text-lime"
                      : on
                        ? "bg-panel-2 text-white"
                        : "text-white/90 hover:bg-panel-2"
                  }`}
                >
                  <Icon name={it.icon} />
                  <span className="flex-1">{it.label}</span>
                  {it.badge &&
                    (it.badgeStyle === "button" ? (
                      <span className="rounded-full bg-lime px-3.5 py-1.5 text-sm font-bold text-ink">{it.badge}</span>
                    ) : (
                      <span className={`-skew-x-12 rounded-md px-2 py-0.5 text-xs font-black italic ${it.badgeStyle === "teal" ? "bg-teal text-ink" : "bg-lime text-ink"}`}>{it.badge}</span>
                    ))}
                </Link>
              );
            })}
          </nav>

          <div className="relative border-t border-line p-5">
            {footer.loggedIn ? (
              <Link href="/profile" onClick={() => setOpen(false)} className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime font-extrabold text-ink">{(footer.name || "K")[0].toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{footer.name}</span>
                  <span className="block truncate text-xs text-muted">{footer.email}</span>
                </span>
                <span className="rounded-full border border-lime/40 bg-lime/10 px-2.5 py-1 text-xs font-bold text-lime">⚡ {footer.credits}</span>
              </Link>
            ) : (
              <>
                <div className="font-bold">{footer.title}</div>
                <p className="mt-1 text-sm text-muted">{footer.text}</p>
              </>
            )}
            <Link href={footer.ctaHref} onClick={() => setOpen(false)} className="mt-4 flex w-full items-center justify-center rounded-full bg-white py-3.5 text-base font-bold text-ink transition hover:bg-lime">
              {footer.cta}
            </Link>
          </div>
        </aside>
      </div>,
      document.body)}
    </>
  );
}
