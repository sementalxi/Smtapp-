"use client";
import { useEffect, useState } from "react";
import { PayModal } from "./PayModal";

/**
 * Pay a payment link right on the KIXO page (Square card form / Apple Pay / Google Pay); Square's page only as a
 * fallback. On an open link (`multi`: many people pay it) the payer first types their name or team — the payment
 * is listed under it for the organizer.
 */
export function PayLinkButton({ id, label, title, price, es, multi = false }: { id: string; label: string; title: string; price: string; es: boolean; multi?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payer, setPayer] = useState("");
  const name = payer.replace(/\s+/g, " ").trim();
  const ready = !multi || name.length >= 2;
  const key = `kixo_payer_${id}`;
  useEffect(() => {
    try {
      // the name typed before leaving for the Cash App (cleared again once a payment went through)
      const saved = multi ? sessionStorage.getItem(key) : null;
      if (saved) setPayer(saved);
      // Back from the Cash App on a phone: reopen the payment window so Square can finish the payment.
      const p = JSON.parse(sessionStorage.getItem("kixo_pay") || "null");
      if (p && p.kind === "link" && p.id === id && Date.now() - p.at < 15 * 60_000 && (!multi || saved)) setOpen(true);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  function typed(v: string) {
    setPayer(v);
    try {
      sessionStorage.setItem(key, v);
    } catch {
      /* ignore */
    }
  }
  // Fallback (on-page form not available, e.g. only Stripe is set up): the provider's checkout page.
  async function hosted() {
    setOpen(false);
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/pay/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payer: name }) });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(
        data.error === "already_paid" ? (es ? "Ya está pagado." : "Already paid.")
        : data.error === "name_required" ? (es ? "Escribe tu nombre o equipo antes de pagar." : "Type your name or team before paying.")
        : data.error === "closed" ? (es ? "Este enlace ya está cerrado." : "This link is closed.")
        : es ? "No se pudo abrir el pago. Inténtalo otra vez." : "Couldn't open checkout. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      {multi && (
        <label className="block text-left text-sm">
          <span className="font-semibold">{es ? "Tu nombre o equipo" : "Your name or team"}</span>
          <input
            id={`payer-${id}`}
            className="input mt-1"
            maxLength={60}
            autoComplete="name"
            placeholder={es ? "Ej. tu equipo o gamertag" : "e.g. your team or gamertag"}
            value={payer}
            onChange={(e) => typed(e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted">{es ? "Así sabemos quién pagó." : "So we know who paid."}</span>
        </label>
      )}
      <button type="button" onClick={() => setOpen(true)} disabled={busy || !ready} className="btn-primary w-full py-4 text-lg disabled:opacity-50">
        {busy ? "…" : `💳 ${label}`}
      </button>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <PayModal
        open={open}
        onClose={() => setOpen(false)}
        kind="link"
        id={id}
        title={title}
        price={price}
        subtitle={multi ? name : es ? "Pedido personalizado" : "Custom order"}
        es={es}
        onFallback={hosted}
        payer={multi ? name : undefined}
        thanks={multi ? (es ? "¡Gracias! Tu pago quedó registrado." : "Thank you! Your payment is in.") : undefined}
      />
    </div>
  );
}
