"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Phones keep the pinch-zoom level across client-side page changes, so a page opened after zooming
 * looks broken (tiny header, huge content). On every route change this puts the zoom back to 1.
 */
export function ZoomReset() {
  const path = usePathname();
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || Math.abs(vv.scale - 1) < 0.02) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const orig = meta.getAttribute("content") || "width=device-width, initial-scale=1";
    // Briefly pinning maximum-scale=1 makes Safari/Chrome re-apply the initial scale; then the original is restored.
    meta.setAttribute("content", `${orig.replace(/,?\s*maximum-scale=[^,]*/i, "")}, maximum-scale=1`);
    const t = setTimeout(() => meta.setAttribute("content", orig), 150);
    window.scrollTo(0, 0);
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
