// Client helper: waits for a Pro poster that is being made in the background.
// Polls every few seconds and right away when the phone screen comes back on.

export type WaitResult = { ok: true; url: string } | { ok: false; error: string; detail?: string };

const PENDING_KEY = "kixo_pending";

export function rememberPending(id: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* private mode */
  }
}
export function forgetPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
/** A poster started in the last 10 minutes that the page lost track of (e.g. the browser reloaded the tab). */
export function pendingBanner(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "null") as { id: string; at: number } | null;
    return v && Date.now() - v.at < 10 * 60_000 ? v.id : null;
  } catch {
    return null;
  }
}

export function waitForBanner(id: string, opts: { previousUrl?: string | null; timeoutMs?: number } = {}): Promise<WaitResult> {
  const deadline = Date.now() + (opts.timeoutMs ?? 9 * 60_000);
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (r: WaitResult) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      resolve(r);
    };
    const check = async () => {
      if (done) return;
      try {
        const res = await fetch(`/api/banners/${id}`, { cache: "no-store" });
        const d = (await res.json()) as { status?: string; finalUrl?: string | null; error?: string | null; detail?: string };
        if (res.ok) {
          if (opts.previousUrl !== undefined) {
            // New version of an existing poster: done when the image changes or an error is saved.
            if (d.finalUrl && d.finalUrl !== opts.previousUrl) return finish({ ok: true, url: d.finalUrl });
            if (d.error) return finish({ ok: false, error: d.error, detail: d.detail });
          } else {
            if (d.status === "READY" && d.finalUrl) return finish({ ok: true, url: d.finalUrl });
            if (d.status === "FAILED") return finish({ ok: false, error: d.error || "err_generic", detail: d.detail });
          }
        } else if (res.status === 404) {
          return finish({ ok: false, error: "err_generic" });
        }
      } catch {
        /* offline for a moment (screen off) — keep trying */
      }
      if (Date.now() > deadline) return finish({ ok: false, error: "err_generic" });
      timer = setTimeout(check, 3000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    timer = setTimeout(check, 4000);
  });
}
