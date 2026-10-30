"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fades/raises every [data-reveal] element into view as you scroll (staggered by data-reveal-delay).
 * Robust to client-side navigation and elements that appear later (watched with a MutationObserver),
 * and never leaves content hidden: anything not revealed within a few seconds is shown anyway.
 */
export function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add("kixo-reveal");

    const show = (el: HTMLElement) => {
      if (el.classList.contains("is-visible")) return;
      el.style.transitionDelay = `${Number(el.dataset.revealDelay ?? 0)}ms`;
      el.classList.add("is-visible");
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );

    const watch = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => io.observe(el));
    };
    watch(document);

    // Elements added or replaced after load (streaming, hydration, navigation).
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches("[data-reveal]")) io.observe(n);
          watch(n);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety net: never leave anything invisible.
    const safety = setTimeout(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.2) show(el);
      });
    }, 1500);
    const onScrollEnd = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
    };
    window.addEventListener("scroll", onScrollEnd, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(safety);
      window.removeEventListener("scroll", onScrollEnd);
    };
  }, [pathname]);

  return null;
}
