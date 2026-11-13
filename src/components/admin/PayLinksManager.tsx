"use client";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

/** One payment of an open link (who paid, how much, how, when). */
export type AdminPayLinkPayment = { id: string; payer: string; amountCents: number; provider: string; at: string };
export type AdminPayLink = {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  customer: string;
  note: string;
  status: string;
  /** Open for everyone: many people pay it and it stays open; `payments` lists who paid. */
  multi: boolean;
  payments: AdminPayLinkPayment[];
  paidAt: string;
  createdAt: string;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
/** The short code on the payer's receipt page — the same one shown here, so a screenshot can be matched. */
const code = (id: string) => id.slice(-6).toUpperCase();
type Action = "cancel" | "reopen" | "paid" | "check" | "multi" | "single" | "add" | "remove" | "delete";

export function PayLinksManager({ initial }: { initial: AdminPayLink[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [links, setLinks] = useState(initial);
  const [f, setF] = useState({ title: "", amount: "", customer: "", description: "", note: "", multi: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");
  // payment times are shown in the admin's own time zone, so they are written once the page runs in the browser
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(true), []);
  const when = (iso: string) => (local ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
  const url = (id: string) => `${window.location.origin}/pay/${id}`;

  async function copy(id: string) {
    const u = url(id);
    try {
      await navigator.clipboard.writeText(u);
    } catch {
      window.prompt(es ? "Copia el enlace:" : "Copy the link:", u);
    }
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  }
  async function share(l: AdminPayLink) {
    const text = `${l.title} — ${money(l.amountCents)}`;
    if (navigator.share) await navigator.share({ title: text, text, url: url(l.id) }).catch(() => {});
    else copy(l.id);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/paylinks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!res.ok) {
        setMsg(es ? "Revisa el título y el precio (mínimo $0.50)." : "Check the title and price (at least $0.50).");
        return;
      }
      const l = data.link;
      const row: AdminPayLink = { ...l, multi: !!l.multi, payments: [], paidAt: "", createdAt: l.createdAt };
      setLinks((x) => [row, ...x]);
      setF({ title: "", amount: "", customer: "", description: "", note: "", multi: f.multi });
      await copy(l.id);
      setMsg(
        row.multi
          ? es ? "✅ Enlace abierto creado y copiado — compártelo con todos los que van a pagar." : "✅ Open link made and copied — share it with everyone who is going to pay."
          : es ? "✅ Enlace creado y copiado — pégalo en el ticket o DM." : "✅ Link made and copied — paste it in the ticket or DM.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: Action, paymentId?: string) {
    let payer: string | undefined;
    if (action === "delete" && !window.confirm(es ? "¿Borrar este enlace? Dejará de funcionar." : "Delete this link? It will stop working.")) return;
    if (action === "paid" && !window.confirm(es ? "¿Marcar como pagado a mano (te pagaron por otro lado)?" : "Mark as paid by hand (they paid you another way)?")) return;
    if (action === "multi" && !window.confirm(es ? "¿Abrir este enlace para todos? Seguirá abierto y lo podrán pagar muchas personas." : "Open this link for everyone? It will stay open and many people can pay it.")) return;
    if (action === "single" && !window.confirm(es ? "¿Dejarlo como un solo pago? Si ya tiene un pago, quedará como Pagado y cerrado." : "Make it one payment? If it already has a payment, it will show as Paid and close.")) return;
    if (action === "remove" && !window.confirm(es ? "¿Quitar este pago de la lista? (No devuelve el dinero: eso se hace en Square / PayPal.)" : "Take this payment off the list? (It does not refund the money: do that in Square / PayPal.)")) return;
    if (action === "add") {
      const typed = window.prompt(es ? "¿Quién pagó? (nombre o equipo — te pagó por otro lado)" : "Who paid? (name or team — they paid you another way)");
      if (typed === null) return;
      payer = typed;
    }
    const res = await fetch(`/api/admin/paylinks/${id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payer, paymentId }) });
    if (!res.ok) return;
    if (action === "delete") return setLinks((x) => x.filter((l) => l.id !== id));
    const { link, payments } = await res.json();
    if (link) setLinks((x) => x.map((l) => (l.id === id ? { ...l, status: link.status, multi: !!link.multi, payments: link.multi ? payments ?? [] : [], paidAt: link.paidAt ?? "" } : l)));
  }

  const pill = "rounded-full px-2 py-0.5 text-xs font-bold";
  const badge = (l: AdminPayLink) => {
    if (l.multi) {
      const n = l.payments.length;
      const paid = n ? ` · ${n} ${es ? (n === 1 ? "pago" : "pagos") : n === 1 ? "payment" : "payments"}` : "";
      return l.status === "canceled" ? (
        <span className={`${pill} bg-white/5 text-muted`}>🔒 {es ? "Cerrado" : "Closed"}{paid}</span>
      ) : (
        <span className={`${pill} bg-green-500/15 text-green-300`}>🟢 {es ? "Abierto" : "Open"}{paid}</span>
      );
    }
    return l.status === "paid" ? <span className={`${pill} bg-green-500/15 text-green-300`}>✅ {es ? "Pagado" : "Paid"}</span>
      : l.status === "canceled" ? <span className={`${pill} bg-white/5 text-muted`}>{es ? "Cancelado" : "Canceled"}</span>
      : <span className={`${pill} bg-amber-400/15 text-amber-200`}>⏳ {es ? "Esperando pago" : "Waiting for payment"}</span>;
  };
  const how = (p: string) => (p === "manual" ? (es ? "a mano" : "by hand") : p === "paypal" ? "PayPal" : p === "square" || p === "stripe" ? (es ? "tarjeta" : "card") : p || "—");
  const choice = (on: boolean) => `rounded-xl border p-3 text-left text-sm transition ${on ? "border-lime bg-lime/5" : "border-line bg-panel-2"}`;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-3 p-5">
        <h2 className="font-display text-2xl">➕ {es ? "Nuevo enlace de pago" : "New payment link"}</h2>
        <div>
          <span className="text-sm font-semibold">{es ? "Quién lo paga" : "Who pays it"}</span>
          <div className="mt-1 grid gap-2 sm:grid-cols-2" role="radiogroup">
            <button type="button" role="radio" aria-checked={!f.multi} className={choice(!f.multi)} onClick={() => setF({ ...f, multi: false })}>
              <span className="block font-bold">👤 {es ? "Un solo pago" : "One payment"}</span>
              <span className="block text-xs text-muted">{es ? "Para una persona. Se cierra cuando lo pagan." : "For one person. It closes once it is paid."}</span>
            </button>
            <button type="button" role="radio" aria-checked={f.multi} className={choice(f.multi)} onClick={() => setF({ ...f, multi: true })}>
              <span className="block font-bold">👥 {es ? "Abierto para todos" : "Open for everyone"}</span>
              <span className="block text-xs text-muted">{es ? "Lo pagan muchas personas y sigue abierto. Ves quién pagó." : "Many people pay it and it stays open. You see who paid."}</span>
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block text-sm">
            <span className="font-semibold">{es ? "Qué es" : "What it is"}</span>
            <input className="input mt-1" required maxLength={120} placeholder={f.multi ? (es ? "Ej. Inscripción al torneo" : "e.g. Tournament entry fee") : es ? "Ej. Pack de 5 pósters para BVF" : "e.g. 5-poster pack for BVF"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">{f.multi ? (es ? "Precio por persona (USD)" : "Price per person (USD)") : es ? "Precio (USD)" : "Price (USD)"}</span>
            <input className="input mt-1" required type="number" min={0.5} step="0.01" inputMode="decimal" placeholder="25.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Para quién (opcional, se ve en la página)" : "Who it's for (optional, shown on the page)"}</span>
          <input className="input mt-1" maxLength={120} placeholder={f.multi ? (es ? "Ej. Equipos del torneo" : "e.g. Teams in the tournament") : es ? "Nombre o usuario de Discord" : "Name or Discord username"} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Detalles (opcional, se ven en la página)" : "Details (optional, shown on the page)"}</span>
          <textarea className="input mt-1 min-h-[70px]" maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Nota privada (solo admins)" : "Private note (admins only)"}</span>
          <input className="input mt-1" maxLength={500} placeholder={es ? "Ej. ticket #0001" : "e.g. ticket #0001"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        {f.multi && <p className="text-xs text-muted">{es ? "Cada persona escribe su nombre o equipo antes de pagar, y aquí aparece en la lista." : "Each person types their name or team before paying, and it shows up in the list here."}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "…" : es ? "Crear y copiar enlace" : "Create & copy link"}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>

      <div className="space-y-3">
        {links.length === 0 && <p className="text-sm text-muted">{es ? "Aún no hay enlaces." : "No links yet."}</p>}
        {links.map((l) => {
          const total = l.payments.reduce((sum, p) => sum + p.amountCents, 0);
          return (
            <div key={l.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{l.title}</p>
                  <p className="text-xs text-muted">
                    {l.multi && <>👥 {es ? "Abierto para todos" : "Open for everyone"} · </>}
                    {l.customer && <>{l.customer} · </>}
                    {new Date(l.createdAt).toLocaleDateString()}
                    {l.note && <> · 📝 {l.note}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl">{money(l.amountCents)}</span>
                  {badge(l)}
                </div>
              </div>
              {l.multi && (
                <div className="rounded-xl border border-line bg-panel-2 p-3 text-sm">
                  {l.payments.length === 0 ? (
                    <p className="text-muted">{es ? "Nadie ha pagado todavía. Comparte el enlace: cada pago aparece aquí." : "Nobody has paid yet. Share the link: every payment shows up here."}</p>
                  ) : (
                    <>
                      <p className="mb-2 font-semibold">
                        {es ? "Pagaron" : "Paid"}: {l.payments.length} · {es ? "Total" : "Total"} {money(total)}
                      </p>
                      <ol className="space-y-1">
                        {l.payments.map((p, n) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="w-6 shrink-0 text-right tabular-nums text-muted">{n + 1}.</span>
                            <span className="min-w-0 flex-1 truncate font-semibold">{p.payer || (es ? "Sin nombre" : "No name")}</span>
                            <span className="tabular-nums">{money(p.amountCents)}</span>
                            <span className="text-xs text-muted">
                              {how(p.provider)} · {when(p.at)} · #{code(p.id)}
                            </span>
                            <button type="button" className="text-xs text-red-300" aria-label={es ? "Quitar este pago" : "Take this payment off"} onClick={() => act(l.id, "remove", p.id)}>✕</button>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                {l.status !== "canceled" && <button type="button" className="btn-ghost !py-1.5" onClick={() => copy(l.id)}>{copied === l.id ? (es ? "✅ Copiado" : "✅ Copied") : es ? "📋 Copiar enlace" : "📋 Copy link"}</button>}
                {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => share(l)}>📤 {es ? "Compartir" : "Share"}</button>}
                <a className="btn-ghost !py-1.5" href={`/pay/${l.id}`} target="_blank" rel="noreferrer">👁️ {es ? "Ver página" : "Open page"}</a>
                {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "check")}>🔄 {es ? (l.multi ? "Revisar pagos" : "Revisar pago") : l.multi ? "Check payments" : "Check payment"}</button>}
                {l.multi && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "add")}>➕ {es ? "Agregar pago a mano" : "Add a payment by hand"}</button>}
                {!l.multi && l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "paid")}>✔️ {es ? "Marcar pagado" : "Mark paid"}</button>}
                {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "cancel")}>{l.multi ? <>🔒 {es ? "Cerrar" : "Close"}</> : <>⛔ {es ? "Cancelar" : "Cancel"}</>}</button>}
                {l.status === "canceled" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "reopen")}>↩️ {es ? (l.multi ? "Abrir otra vez" : "Reactivar") : "Reopen"}</button>}
                {l.multi ? (
                  <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "single")}>👤 {es ? "Dejar en un solo pago" : "Make it one payment"}</button>
                ) : (
                  <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "multi")}>👥 {es ? "Abrir para todos" : "Open for everyone"}</button>
                )}
                <button type="button" className="btn-ghost !py-1.5 text-red-300" onClick={() => act(l.id, "delete")}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
