"use client";

import { useEffect } from "react";
import { sfx, type Sfx } from "@/lib/sfx";

/** Clicks inside poster-making areas make a soft tap; elements with data-sfx="…" play that sound. */
export function SoundEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest) return;
      const tagged = el.closest("[data-sfx]") as HTMLElement | null;
      if (tagged) return sfx((tagged.dataset.sfx as Sfx) || "tap");
      if (el.closest("[data-sfx-area] button, [data-sfx-area] a, [data-sfx-area] label")) sfx("tap");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
