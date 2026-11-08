"use client";
import { useState } from "react";

export function PayLinkButton({ id, label, es }: { id: string; label: string; es: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/pay/${id}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(data.error === "already_paid" ? (es ? "Ya está pagado." : "Already paid.") : es ? "No se pudo abrir el pago. Inténtalo otra vez." : "Couldn't open checkout. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={go} disabled={busy} className="btn-primary w-full py-4 text-lg">
        {busy ? "…" : `💳 ${label}`}
      </button>
      {err && <p className="text-sm text-red-300">{err}</p>}
    </div>
  );
}
