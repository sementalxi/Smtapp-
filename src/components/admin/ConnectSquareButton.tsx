"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConnectSquareButton({ es, connected }: { es?: boolean; connected?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  return (
    <div className="card flex flex-wrap items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="font-bold">
          {connected ? "✅ " : ""}
          {es ? "Pagos con Square" : "Square payments"}
        </div>
        <p className="text-sm text-muted">
          {connected
            ? es
              ? "Conectado. Las compras y suscripciones suman créditos automáticamente. Vuelve a conectar si cambias de dominio."
              : "Connected. Purchases and subscriptions add credits automatically. Reconnect if you change your domain."
            : es
              ? "Crea los planes mensuales en tu Square y registra este sitio para que los pagos sumen créditos solos."
              : "Creates the monthly plans in your Square account and registers this site so payments add credits automatically."}
        </p>
      </div>
      <button
        disabled={busy}
        className={connected ? "btn-ghost" : "btn-primary"}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          const res = await fetch("/api/admin/square-connect", { method: "POST" });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (res.ok) {
            setMsg(es ? "✅ Conectado" : "✅ Connected");
            router.refresh();
          } else setMsg(data.error ?? "Something went wrong");
        }}
      >
        {busy ? "…" : connected ? (es ? "Reconectar" : "Reconnect") : es ? "Conectar Square" : "Connect Square"}
      </button>
      {msg && <p className={`w-full text-sm ${msg.startsWith("✅") ? "text-lime" : "text-danger"}`}>{msg}</p>}
    </div>
  );
}
