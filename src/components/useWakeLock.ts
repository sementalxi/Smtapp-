"use client";

import { useEffect } from "react";

type Sentinel = { release: () => Promise<void> };

/** Keeps the phone screen awake while `active` (e.g. while a poster is generating). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: Sentinel | null = null;
    let done = false;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock.request("screen");
        if (done) lock.release().catch(() => {});
      } catch {
        /* not allowed (low battery mode, etc.) — ignore */
      }
    };
    request();
    // The lock drops when the tab is hidden — take it again when they come back.
    const onVis = () => document.visibilityState === "visible" && !done && request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
