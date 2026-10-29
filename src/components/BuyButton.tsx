"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

export function BuyButton({
  kind,
  id,
  label,
  loggedIn,
  primary,
}: {
  kind: "pack" | "plan" | "portal";
  id?: string;
  label: string;
  loggedIn: boolean;
  primary?: boolean;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    if (!loggedIn) {
      window.location.href = "/register";
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

  return (
    <div>
      <button onClick={go} disabled={busy} className={`${primary ? "btn-primary" : "btn-ghost"} w-full`}>
        {busy ? "…" : label}
      </button>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
