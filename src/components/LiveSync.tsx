"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page in sync: when an admin changes something (styles, settings, texts…) or
 * something new appears (a poster finished, a deletion), the page refreshes its data on its
 * own — no manual reload. Polls a tiny endpoint while the tab is visible and on every focus.
 */
export function LiveSync({ rev }: { rev: string }) {
  const router = useRouter();
  const seen = useRef(rev);
  useEffect(() => {
    seen.current = rev;
  }, [rev]);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/rev", { cache: "no-store" });
        const j = (await r.json()) as { rev?: string };
        if (j.rev && j.rev !== seen.current) {
          seen.current = j.rev;
          router.refresh();
        }
      } catch {}
    };
    const loop = () => {
      timer = setTimeout(async () => {
        await check();
        if (!stop) loop();
      }, 5_000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    loop();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);
  return null;
}
