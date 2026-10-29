"use client";

import { useEffect, useState } from "react";
import { canvasFonts } from "@/app/fonts";

let ready: Promise<void> | null = null;

/** Canvas can't draw web fonts until they're loaded; this waits once per page. */
export function loadBannerFonts() {
  if (!ready) {
    ready = Promise.all(
      Object.values(canvasFonts).flatMap((fam) => [
        document.fonts.load(`400 40px ${fam}`),
        document.fonts.load(`800 40px ${fam}`),
      ]),
    )
      .then(() => undefined)
      .catch(() => undefined);
  }
  return ready;
}

export function useBannerFonts() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    loadBannerFonts().then(() => setOk(true));
  }, []);
  return ok;
}
