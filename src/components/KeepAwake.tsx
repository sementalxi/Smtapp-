"use client";

import { useEffect } from "react";

type Sentinel = { release: () => Promise<void>; released?: boolean; addEventListener?: (t: "release", f: () => void) => void };

/** Keeps the phone screen on the whole time someone is on the website. */
export function KeepAwake() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: Sentinel | null = null;
    let busy = false;
    const want = async () => {
      if (busy || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      busy = true;
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock.request("screen");
        lock.addEventListener?.("release", () => { lock = null; });
      } catch {
        /* needs a tap first on some phones, or low-power mode blocks it */
      }
      busy = false;
    };
    want();
    // The lock drops when they switch apps or tabs — take it again when they come back, and on taps (some phones need one).
    const onVis = () => want();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("pointerdown", onVis, { capture: true });
    const t = setInterval(want, 30_000);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("pointerdown", onVis, { capture: true });
      lock?.release().catch(() => {});
    };
  }, []);
  return null;
}
