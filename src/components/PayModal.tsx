"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TokenResult = { status: string; token?: string; errors?: { message: string }[] };
type SqCard = { attach: (sel: string | HTMLElement, opts?: unknown) => Promise<void>; tokenize: (details?: unknown) => Promise<TokenResult>; destroy: () => Promise<void> };
type SqCashApp = SqCard & { addEventListener: (ev: string, cb: (e: { detail: { tokenResult?: TokenResult; error?: { message?: string } } }) => void) => void };
type SqPayments = {
  card: (opts?: unknown) => Promise<SqCard>;
  paymentRequest: (r: unknown) => unknown;
  applePay: (req: unknown) => Promise<SqCard>;
  googlePay: (req: unknown) => Promise<SqCard>;
  cashAppPay: (req: unknown, opts: unknown) => Promise<SqCashApp>;
};
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SqPayments };
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
  const gpBox = useRef<HTMLDivElement>(null);
  const capBox = useRef<HTMLDivElement>(null);
  const apple = useRef<SqCard | null>(null);
  const google = useRef<SqCard | null>(null);
  const cash = useRef<SqCashApp | null>(null);
  const [wallets, setWallets] = useState({ apple: false, google: false, cash: false });
  const amountRef = useRef("0");
  const [adminNote, setAdminNote] = useState("");
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
        const cfg = await fetch(`/api/square/config?kind=${kind}&id=${encodeURIComponent(id)}`).then((r) => r.json());
        if (!cfg.inline) {
          onFallback();
          return;
        }
        amountRef.current = String(cfg.amount ?? "0");
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

        // Wallets — one-time purchases only (Square subscriptions need a saved card).
        if (kind !== "plan" && Number(cfg.amount) > 0) {
          const req = payments.paymentRequest({ countryCode: "US", currencyCode: "USD", total: { amount: String(cfg.amount), label: title.slice(0, 60) || "KIXO" } });
          try {
            const ap = await payments.applePay(req);
            apple.current = ap;
            if (alive) setWallets((w) => ({ ...w, apple: true }));
          } catch (e) {
            if (cfg.applePay !== undefined) setAdminNote(`Apple Pay: ${e instanceof Error ? e.message : String(e)} · domain: ${cfg.applePay}`);
          }
          try {
            const gp = await payments.googlePay(req);
            if (gpBox.current) {
              await gp.attach(gpBox.current, { buttonColor: "white", buttonSizeMode: "fill", buttonType: "long" });
              google.current = gp;
              if (alive) setWallets((w) => ({ ...w, google: true }));
            }
          } catch {
            /* unavailable */
          }
          try {
            const ca = await payments.cashAppPay(req, { redirectURL: window.location.href, referenceId: `${kind}-${id}`.slice(0, 40) });
            if (capBox.current) {
              // Phones leave for the Cash App and come back to this page — remember to reopen this popup.
              capBox.current.onclick = () => {
                try {
                  sessionStorage.setItem("kixo_pay", JSON.stringify({ kind, id, at: Date.now() }));
                } catch {
                  /* ignore */
                }
              };
              await ca.attach(capBox.current, { shape: "semiround", width: "full" });
              ca.addEventListener("ontokenization", (e) => {
                const { tokenResult, error } = e.detail;
                if (error || tokenResult?.status !== "OK" || !tokenResult.token) setErr(error?.message || (es ? "Cash App no completó el pago" : "Cash App didn't complete the payment"));
                else charge(tokenResult.token);
              });
              cash.current = ca;
              if (alive) setWallets((w) => ({ ...w, cash: true }));
            }
          } catch {
            /* unavailable */
          }
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "error");
      }
    })();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.body.style.overflow = prev;
      for (const r of [card, google, cash, apple]) {
        r.current?.destroy?.().catch(() => {});
        r.current = null;
      }
      setWallets({ apple: false, google: false, cash: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function pay(method: SqCard | null = card.current) {
    if (!method) return;
    setBusy(true);
    setErr("");
    try {
      // Card: include buyer verification (3-D Secure) so banks don't decline it.
      const t =
        method === card.current
          ? await method
              .tokenize({
                amount: amountRef.current,
                currencyCode: "USD",
                intent: kind === "plan" ? "STORE" : "CHARGE",
                customerInitiated: true,
                sellerKeyedIn: false,
                billingContact: {},
              })
              .catch(() => method.tokenize())
          : await method.tokenize();
      if (t.status !== "OK" || !t.token) {
        if (t.status !== "Cancel") setErr(t.errors?.[0]?.message ?? (es ? "Revisa los datos de pago" : "Check the payment details"));
        setBusy(false);
        return;
      }
      await charge(t.token, true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
    setBusy(false);
  }

  async function charge(token: string, already = false) {
    if (!already) setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/square/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, sourceId: token }) });
      const d = await r.json().catch(() => ({}));
      try {
        sessionStorage.removeItem("kixo_pay");
      } catch {
        /* ignore */
      }
      if (r.ok && d.ok) {
        setDone({ credits: d.credits, pending: d.pending });
        setTimeout(() => window.location.assign("/credits"), d.pending ? 4500 : 2200);
      } else {
        setErr(
          d.error === "declined"
            ? (es ? "La tarjeta fue rechazada. Prueba con otra." : "The card was declined. Try another one.") + (d.detail ? ` (${d.detail})` : "")
            : d.error === "already_subscribed"
              ? es ? "Ya tienes una suscripción activa." : "You already have an active subscription."
              : (es ? "No se pudo completar el pago" : "Payment couldn't be completed") + (d.detail ? ` — ${d.detail}` : ""),
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    }
    if (!already) setBusy(false);
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
            {kind !== "plan" && (
              <div className="space-y-2">
                {wallets.apple && (
                  <button type="button" disabled={busy} onClick={() => pay(apple.current)} className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-[17px] font-semibold text-black disabled:opacity-50">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M16.37 12.46c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.03c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z" /></svg>
                    Pay
                  </button>
                )}
                <div ref={gpBox} className={wallets.google ? "h-12 overflow-hidden rounded-xl" : "hidden"} />
                <div ref={capBox} className={wallets.cash ? "" : "hidden"} />
                {(wallets.apple || wallets.google || wallets.cash) && (
                  <div className="flex items-center gap-3 py-1 text-[11px] uppercase tracking-widest text-muted">
                    <span className="h-px flex-1 bg-line" />
                    {es ? "o con tarjeta" : "or pay with card"}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
              </div>
            )}
            <div className="min-h-[96px] rounded-2xl border border-line bg-ink/40 p-2">
              <div ref={box} />
              {!ready && !err && <div className="p-6 text-center text-xs text-muted">{es ? "Cargando formulario seguro…" : "Loading secure form…"}</div>}
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            {adminNote && <p className="rounded-lg border border-line p-2 text-[10px] text-muted">🛠 {adminNote}</p>}
            <button type="button" className="btn-primary kixo-shine w-full py-3.5 text-base" disabled={!ready || busy} onClick={() => pay()}>
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
