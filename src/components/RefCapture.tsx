"use client";

import { useEffect } from "react";

/** Remembers an invite code from a ?ref=CODE link for 30 days, so signing up later still counts. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
        document.cookie = `kixo_ref=${ref.toUpperCase()}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      }
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
