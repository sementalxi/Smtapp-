"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { PayModal, preloadSquarePay } from "./PayModal";

export function BuyButton({
  kind,
  id,
  label,
  loggedIn,
  primary,
  disabled,
  checkout,
}: {
  kind: "pack" | "plan" | "deal" | "portal" | "cancel";
  id?: string;
  label: string;
  loggedIn: boolean;
  primary?: boolean;
  /** Payments not set up yet (no Stripe key) */
  disabled?: boolean;
  /** Shown in the on-page payment popup (Square). */
  checkout?: { title: string; price: string; subtitle?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { t, locale } = useT();
  const es = locale === "es";

  const [modal, setModal] = useState(false);
  // Warm up the payment form in the background so the popup opens instantly.
  useEffect(() => {
    if (!checkout || !id || !loggedIn || !(kind === "pack" || kind === "plan" || kind === "deal")) return;
    const t = setTimeout(() => preloadSquarePay(kind, id), 1200);
    return () => clearTimeout(t);
  }, [checkout, id, kind, loggedIn]);
  // Back from the Cash App: reopen the same popup so the payment can finish.
  useEffect(() => {
    if (!checkout || !id) return;
    try {
      const p = JSON.parse(sessionStorage.getItem("kixo_pay") || "null");
      if (p && p.kind === kind && p.id === id && Date.now() - p.at < 15 * 60_000) setModal(true);
    } catch {
      /* ignore */
    }
  }, [checkout, id, kind]);

  async function go(skipModal = false) {
    if (!loggedIn) {
      window.location.href = "/register";
      return;
    }
    if (!skipModal && checkout && (kind === "pack" || kind === "plan" || kind === "deal")) {
      setModal(true);
      return;
    }
    if (kind === "cancel") {
      if (!confirm) return setConfirm(true);
      setBusy(true);
      const res = await fetch("/api/square/cancel", { method: "POST" });
      if (res.ok) window.location.reload();
      else {
        setErr(t("err_generic"));
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch(kind === "portal" ? "/api/stripe/portal" : "/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setErr(
      data.error === "already_subscribed"
        ? locale === "es" ? "Ya tienes una suscripción activa." : "You already have an active subscription."
        : data.error === "unauthorized"
          ? locale === "es" ? "Inicia sesión otra vez." : "Please log in again."
          : t("err_generic") + (data.detail ? ` — ${data.detail}` : data.error ? ` (${data.error})` : ""),
    );
    setBusy(false);
  }

  if (disabled) {
    return (
      <button disabled className="btn-ghost w-full">
        {t("coming_soon")}
      </button>
    );
  }

  return (
    <div>
      {checkout && (kind === "pack" || kind === "plan" || kind === "deal") && id && (
        <PayModal
          open={modal}
          onClose={() => setModal(false)}
          kind={kind}
          id={id}
          title={checkout.title}
          price={checkout.price}
          subtitle={checkout.subtitle}
          es={es}
          onFallback={() => {
            setModal(false);
            go(true);
          }}
        />
      )}
      <button onClick={() => go()} disabled={busy} className={`${primary ? "btn-primary" : "btn-ghost"} w-full`}>
        {busy ? "…" : confirm ? (es ? "¿Seguro? Toca para cancelar" : "Sure? Tap to cancel") : label}
      </button>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
