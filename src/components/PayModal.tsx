"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SqCard = { attach: (sel: string | HTMLElement) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>; destroy: () => Promise<void> };
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => { card: (opts?: unknown) => Promise<SqCard> } };
  }
}

function loadSquare(sandbox: boolean) {
  return new Promise<void>((resolve, reject) => {
    if (window.Square) return resolve();
    const s = document.createElement("script");
    s.src = sandbox ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment form"));
    document.head.appendChild(s);
  });
}

/** On-page checkout popup: card form by Square, charged without leaving KIXO. */
export function PayModal({
  open,
  onClose,
  kind,
  id,
  title,
  price,
  subtitle,
  es,
  onFallback,
}: {
  open: boolean;
  onClose: () => void;
  kind: "pack" | "plan" | "deal";
  id: string;
  title: string;
  price: string;
  subtitle?: string;
  es: boolean;
  /** Called when the on-page form isn't available (falls back to Square's page). */
  onFallback: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const card = useRef<SqCard | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | { credits: number; pending?: boolean }>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setErr("");
    setDone(null);
    setReady(false);
    (async () => {
      try {
        const cfg = await fetch("/api/square/config").then((r) => r.json());
        if (!cfg.inline) {
          onFallback();
          return;
        }
        await loadSquare(!!cfg.sandbox);
        if (!alive || !window.Square || !box.current) return;
        const payments = window.Square.payments(cfg.appId, cfg.locationId);
        const c = await payments.card({
          style: {
            input: { color: "#f1f8f3", fontSize: "16px" },
            "input::placeholder": { color: "#7f8f86" },
            ".input-container": { borderColor: "#26332b", borderRadius: "12px" },
            ".input-container.is-focus": { borderColor: "#b7ff45" },
            ".message-text": { color: "#9aaba1" },
            ".message-icon": { color: "#9aaba1" },
          },
        });
        await c.attach(box.current);
        card.current = c;
        if (alive) setReady(true);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "error");
      }
    })();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.body.style.overflow = prev;
      card.current?.destroy().catch(() => {});
      card.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pay() {
    if (!card.current) return;
    setBusy(true);
    setErr("");
    try {
      const t = await card.current.tokenize();
      if (t.status !== "OK" || !t.token) {
        setErr(t.errors?.[0]?.message ?? (es ? "Revisa los datos de la tarjeta" : "Check the card details"));
        setBusy(false);
        return;
      }
      const r = await fetch("/api/square/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, sourceId: t.token }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setDone({ credits: d.credits, pending: d.pending });
        setTimeout(() => window.location.assign("/credits"), d.pending ? 4500 : 2200);
      } else {
        setErr(
          d.error === "declined"
            ? es ? "La tarjeta fue rechazada. Prueba con otra." : "The card was declined. Try another one."
            : d.error === "already_subscribed"
              ? es ? "Ya tienes una suscripción activa." : "You already have an active subscription."
              : (es ? "No se pudo completar el pago" : "Payment couldn't be completed") + (d.detail ? ` — ${d.detail}` : ""),
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
    setBusy(false);
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => !busy && !done && onClose()}>
      <div className="kixo-fade-up relative w-full max-w-md overflow-hidden rounded-t-3xl border border-lime/30 bg-gradient-to-b from-panel-2 to-panel p-5 shadow-[0_-20px_80px_-20px_rgba(0,0,0,0.9)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl" />
        {done ? (
          <div className="relative py-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime text-3xl text-ink shadow-[0_0_40px_rgba(183,255,69,0.6)]">✓</div>
            <div className="font-display mt-4 text-3xl">{es ? "¡Pago completado!" : "Payment complete!"}</div>
            <p className="mt-1 text-sm text-muted">
              {done.pending
                ? es ? `Tu plan está activo. Tus ${done.credits} créditos llegan en unos segundos…` : `Your plan is active. Your ${done.credits} credits arrive in a few seconds…`
                : es ? `+${done.credits} créditos agregados a tu cuenta` : `+${done.credits} credits added to your account`}
            </p>
          </div>
        ) : (
          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-teal">{es ? "Pago seguro" : "Secure checkout"}</div>
                <div className="mt-0.5 text-lg font-extrabold">{title}</div>
                {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
              </div>
              <div className="text-right">
                <div className="font-display text-3xl text-lime">{price}</div>
                {kind === "plan" && <div className="text-[10px] text-muted">{es ? "por mes" : "per month"}</div>}
              </div>
            </div>
            <div className="min-h-[96px] rounded-2xl border border-line bg-ink/40 p-2">
              <div ref={box} />
              {!ready && !err && <div className="p-6 text-center text-xs text-muted">{es ? "Cargando formulario seguro…" : "Loading secure form…"}</div>}
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <button type="button" className="btn-primary kixo-shine w-full py-3.5 text-base" disabled={!ready || busy} onClick={pay}>
              {busy ? (es ? "Procesando…" : "Processing…") : `🔒 ${es ? "Pagar" : "Pay"} ${price}`}
            </button>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>🔒 {es ? "Procesado por Square · no guardamos tu tarjeta" : "Processed by Square · we never store your card"}</span>
              <button type="button" className="underline" disabled={busy} onClick={onClose}>{es ? "Cancelar" : "Cancel"}</button>
            </div>
            {kind === "plan" && <p className="text-[11px] text-muted">{es ? "Se renueva cada mes. Cancela cuando quieras desde Facturación." : "Renews monthly. Cancel anytime from Billing."}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
