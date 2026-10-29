"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectStripeButton({ es }: { es?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="font-bold">{es ? "Conectar Stripe" : "Connect Stripe"}</div>
        <p className="text-sm text-muted">
          {es
            ? "Registra este sitio en Stripe para que las compras y suscripciones sumen créditos automáticamente."
            : "Registers this site with Stripe so purchases and subscriptions add credits automatically."}
        </p>
      </div>
      <button
        disabled={busy}
        className="btn-primary"
        onClick={async () => {
          setBusy(true);
          setMsg("");
          const res = await fetch("/api/admin/stripe-webhook", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (res.ok) router.refresh();
          else setMsg(data.error ?? "Something went wrong");
        }}
      >
        {busy ? "…" : es ? "Conectar Stripe" : "Connect Stripe"}
      </button>
      {msg && <p className="w-full text-sm text-danger">{msg}</p>}
    </div>
  );
}
