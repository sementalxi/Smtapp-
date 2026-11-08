"use client";
import { useState } from "react";
import { PayModal } from "./PayModal";

/** Pay a custom order right on the KIXO page (Square card form / Apple Pay / Google Pay); Square's page only as a fallback. */
export function PayLinkButton({ id, label, title, price, es }: { id: string; label: string; title: string; price: string; es: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Fallback (on-page form not available, e.g. only Stripe is set up): the provider's checkout page.
  async function hosted() {
    setOpen(false);
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
      <button type="button" onClick={() => setOpen(true)} disabled={busy} className="btn-primary w-full py-4 text-lg">
        {busy ? "…" : `💳 ${label}`}
      </button>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <PayModal open={open} onClose={() => setOpen(false)} kind="link" id={id} title={title} price={price} subtitle={es ? "Pedido personalizado" : "Custom order"} es={es} onFallback={hosted} />
    </div>
  );
}
