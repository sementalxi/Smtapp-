"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

export function BuyButton({
  kind,
  id,
  label,
  loggedIn,
  primary,
  disabled,
}: {
  kind: "pack" | "plan" | "portal" | "cancel";
  id?: string;
  label: string;
  loggedIn: boolean;
  primary?: boolean;
  /** Payments not set up yet (no Stripe key) */
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { t, locale } = useT();
  const es = locale === "es";

  async function go() {
    if (!loggedIn) {
      window.location.href = "/register";
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
    setErr(t("err_generic"));
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
      <button onClick={go} disabled={busy} className={`${primary ? "btn-primary" : "btn-ghost"} w-full`}>
        {busy ? "…" : confirm ? (es ? "¿Seguro? Toca para cancelar" : "Sure? Tap to cancel") : label}
      </button>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
