"use client";
import { useState } from "react";
import { useT } from "@/i18n/client";

export type AdminPayLink = { id: string; title: string; description: string; amountCents: number; customer: string; note: string; status: string; paidAt: string; createdAt: string };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PayLinksManager({ initial }: { initial: AdminPayLink[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const [links, setLinks] = useState(initial);
  const [f, setF] = useState({ title: "", amount: "", customer: "", description: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");
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
      const row: AdminPayLink = { ...l, paidAt: "", createdAt: l.createdAt };
      setLinks((x) => [row, ...x]);
      setF({ title: "", amount: "", customer: "", description: "", note: "" });
      await copy(l.id);
      setMsg(es ? "✅ Enlace creado y copiado — pégalo en el ticket o DM." : "✅ Link made and copied — paste it in the ticket or DM.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "cancel" | "reopen" | "paid" | "check" | "delete") {
    if (action === "delete" && !window.confirm(es ? "¿Borrar este enlace? Dejará de funcionar." : "Delete this link? It will stop working.")) return;
    if (action === "paid" && !window.confirm(es ? "¿Marcar como pagado a mano (te pagaron por otro lado)?" : "Mark as paid by hand (they paid you another way)?")) return;
    const res = await fetch(`/api/admin/paylinks/${id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) return;
    if (action === "delete") return setLinks((x) => x.filter((l) => l.id !== id));
    const { link } = await res.json();
    if (link) setLinks((x) => x.map((l) => (l.id === id ? { ...l, status: link.status, paidAt: link.paidAt ?? "" } : l)));
  }

  const badge = (s: string) =>
    s === "paid" ? <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-bold text-green-300">✅ {es ? "Pagado" : "Paid"}</span>
    : s === "canceled" ? <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-muted">{es ? "Cancelado" : "Canceled"}</span>
    : <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">⏳ {es ? "Esperando pago" : "Waiting for payment"}</span>;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card space-y-3 p-5">
        <h2 className="font-display text-2xl">➕ {es ? "Nuevo enlace de pago" : "New payment link"}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block text-sm">
            <span className="font-semibold">{es ? "Qué es" : "What it is"}</span>
            <input className="input mt-1" required maxLength={120} placeholder={es ? "Ej. Pack de 5 pósters para BVF" : "e.g. 5-poster pack for BVF"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">{es ? "Precio (USD)" : "Price (USD)"}</span>
            <input className="input mt-1" required type="number" min={0.5} step="0.01" inputMode="decimal" placeholder="25.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Para quién (opcional, se ve en la página)" : "Who it's for (optional, shown on the page)"}</span>
          <input className="input mt-1" maxLength={120} placeholder={es ? "Nombre o usuario de Discord" : "Name or Discord username"} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Detalles (opcional, se ven en la página)" : "Details (optional, shown on the page)"}</span>
          <textarea className="input mt-1 min-h-[70px]" maxLength={1000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">{es ? "Nota privada (solo admins)" : "Private note (admins only)"}</span>
          <input className="input mt-1" maxLength={500} placeholder={es ? "Ej. ticket #0001" : "e.g. ticket #0001"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
        <button className="btn-primary" disabled={busy}>{busy ? "…" : es ? "Crear y copiar enlace" : "Create & copy link"}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>

      <div className="space-y-3">
        {links.length === 0 && <p className="text-sm text-muted">{es ? "Aún no hay enlaces." : "No links yet."}</p>}
        {links.map((l) => (
          <div key={l.id} className="card space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{l.title}</p>
                <p className="text-xs text-muted">
                  {l.customer && <>{l.customer} · </>}
                  {new Date(l.createdAt).toLocaleDateString()}
                  {l.note && <> · 📝 {l.note}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl">{money(l.amountCents)}</span>
                {badge(l.status)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {l.status !== "canceled" && <button type="button" className="btn-ghost !py-1.5" onClick={() => copy(l.id)}>{copied === l.id ? (es ? "✅ Copiado" : "✅ Copied") : es ? "📋 Copiar enlace" : "📋 Copy link"}</button>}
              {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => share(l)}>📤 {es ? "Compartir" : "Share"}</button>}
              <a className="btn-ghost !py-1.5" href={`/pay/${l.id}`} target="_blank" rel="noreferrer">👁️ {es ? "Ver página" : "Open page"}</a>
              {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "check")}>🔄 {es ? "Revisar pago" : "Check payment"}</button>}
              {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "paid")}>✔️ {es ? "Marcar pagado" : "Mark paid"}</button>}
              {l.status === "open" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "cancel")}>⛔ {es ? "Cancelar" : "Cancel"}</button>}
              {l.status === "canceled" && <button type="button" className="btn-ghost !py-1.5" onClick={() => act(l.id, "reopen")}>↩️ {es ? "Reactivar" : "Reopen"}</button>}
              <button type="button" className="btn-ghost !py-1.5 text-red-300" onClick={() => act(l.id, "delete")}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
