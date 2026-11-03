"use client";

import { useEffect } from "react";
import { sfx, unlockAudio, type Sfx } from "@/lib/sfx";

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
    const unlock = () => unlockAudio();
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerdown", unlock, { capture: true });
      document.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);
  return null;
}
