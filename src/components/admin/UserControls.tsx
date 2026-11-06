"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export function CreditAdjust({ userId }: { userId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function apply(n: number) {
    if (!Number.isInteger(n) || n === 0) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: n, note: note || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `${t("saved_ok")} → ${data.balance}` });
      setNote("");
      router.refresh();
    } else setMsg({ ok: false, text: data.error ?? t("err_generic") });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-bold">{t("adjust_credits")}</h2>
      <div className="flex flex-wrap gap-2">
        {[5, 10, 25, 50, 100].map((n) => (
          <button key={n} disabled={busy} onClick={() => apply(n)} className="btn-ghost px-3 py-1.5 text-xs">
            +{n}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <div>
          <input
            type="number"
            step={1}
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t("amount")}
          />
        </div>
        <input className="input" placeholder={t("reason")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <button disabled={busy} onClick={() => apply(Math.trunc(Number(amount)))} className="btn-primary">
          {t("apply")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("amount_hint")}</p>
      {msg && <p className={`text-sm ${msg.ok ? "text-lime" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

export function UserFlags({ userId, role, banned, self, isOrg = false, es = false }: { userId: string; role: string; banned: boolean; self: boolean; isOrg?: boolean; es?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr((await res.json().catch(() => ({}))).error ?? t("err_generic"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select disabled={busy || self} value={role} onChange={(e) => patch({ role: e.target.value as "USER" | "ADMIN" | "STAFF" | "SUPPORT" })} className="input !w-auto py-1.5 text-xs">
        <option value="USER">👤 User</option>
        <option value="STAFF">🎨 Staff</option>
        <option value="SUPPORT">🎧 Support</option>
        <option value="ADMIN">👑 Admin</option>
      </select>
      <button
        disabled={busy || self}
        onClick={() => patch({ banned: !banned })}
        className={`${banned ? "btn-ghost" : "btn-danger"} px-3 py-1.5 text-xs`}
      >
        {banned ? t("unban") : t("ban")}
      </button>
      <button
        disabled={busy}
        onClick={() => patch({ isOrg: !isOrg })}
        className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${isOrg ? "border-sky-400 bg-sky-500/15 text-sky-300" : "border-line text-muted"}`}
      >
        {isOrg ? (es ? "🏢 Organización ✓" : "🏢 Organization ✓") : es ? "🏢 Marcar como organización" : "🏢 Make organization"}
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}

/** Admin: make a one-time password reset link for this user. */
/** Admin only: the account's phone number (players can't change theirs) — set it, fix it or clear it. */
export function PhoneControl({ userId, phone, es, canEdit }: { userId: string; phone: string | null; es: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(next: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: next }) });
    setBusy(false);
    if (res.ok) {
      setValue(next);
      setMsg(es ? "✅ Guardado" : "✅ Saved");
      router.refresh();
    } else setMsg(`❌ ${(await res.json().catch(() => ({}))).error ?? "error"}`);
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted">📱 {es ? "Teléfono" : "Phone"}:</span>
      {canEdit ? (
        <>
          <input className="input !w-44 py-1.5 text-xs" value={value} placeholder="+1 512 555 0100" onChange={(e) => setValue(e.target.value)} />
          <button type="button" disabled={busy || value === (phone ?? "")} className="btn-primary px-3 py-1.5 text-xs" onClick={() => save(value)}>
            {es ? "Guardar" : "Save"}
          </button>
          {phone && (
            <button type="button" disabled={busy} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => save("")}>
              {es ? "Quitar" : "Clear"}
            </button>
          )}
        </>
      ) : (
        <span className="font-mono">{phone || (es ? "— sin número" : "— none")}</span>
      )}
      {msg && <span>{msg}</span>}
    </div>
  );
}

export function ResetLink({ userId, es }: { userId: string; es: boolean }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function make() {
    setBusy(true);
    const d = await fetch(`/api/admin/users/${userId}/reset-link`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (d.url) setUrl(d.url);
  }
  return (
    <div className="card space-y-2 p-4 text-sm">
      <div className="font-bold">🔑 {es ? "Restablecer contraseña" : "Reset password"}</div>
      {!url ? (
        <button type="button" className="btn-ghost w-full" disabled={busy} onClick={make}>{busy ? "…" : es ? "Crear enlace de restablecimiento" : "Create reset link"}</button>
      ) : (
        <>
          <input className="input text-xs" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <a href={url} className="btn-primary flex-1 text-center">{es ? "Abrir" : "Open"}</a>
            <button type="button" className="btn-ghost flex-1" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}>{copied ? "✓" : es ? "Copiar" : "Copy"}</button>
          </div>
          <p className="text-[11px] text-muted">{es ? "Vale 30 minutos y un solo uso. Al abrirlo inicias sesión como ese usuario." : "Valid 30 minutes, one use. Opening it logs you in as that user."}</p>
        </>
      )}
    </div>
  );
}

/** Admin: give a free plan (monthly credits + the plan's AI quality) for N months. */
export function GivePlan({ userId, plans, current, until, paying, es }: { userId: string; plans: { id: string; name: string; monthlyCredits: number }[]; current: string | null; until: string | null; paying: boolean; es: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState(current ?? plans[0]?.id ?? "");
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function send(planId: string | null) {
    setBusy(true);
    setMsg("");
    const r = await fetch(`/api/admin/users/${userId}/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, months }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setMsg(planId ? (es ? "✅ Plan activado y créditos del mes añadidos" : "✅ Plan on and this month's credits added") : es ? "✅ Plan quitado y créditos del regalo retirados" : "✅ Plan removed and gift credits taken back");
      router.refresh();
    } else setMsg(d.error === "paying" ? (es ? "❌ Este usuario ya paga una suscripción" : "❌ This user already pays for a subscription") : es ? "❌ No se pudo" : "❌ Couldn't do it");
  }
  return (
    <div className="card space-y-2 p-4 text-sm">
      <div className="font-bold">⭐ {es ? "Dar un plan gratis" : "Give a free plan"}</div>
      {paying ? (
        <p className="text-xs text-muted">{es ? "Tiene una suscripción pagada activa." : "Has an active paid subscription."}</p>
      ) : (
        <>
          {current && until && <p className="text-xs text-teal">{es ? "Plan regalado hasta" : "Gift plan until"} {new Date(until).toLocaleDateString()}</p>}
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.monthlyCredits} {es ? "créditos/mes" : "credits/mo"}</option>
              ))}
            </select>
            <select className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {[1, 2, 3, 6, 12].map((m) => (
                <option key={m} value={m}>{m} {es ? (m === 1 ? "mes" : "meses") : m === 1 ? "month" : "months"}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={busy || !plan} onClick={() => send(plan)}>{busy ? "…" : current ? (es ? "Cambiar / extender" : "Change / extend") : es ? "Dar plan" : "Give plan"}</button>
            {current && <button type="button" className="btn-ghost" disabled={busy} onClick={() => send(null)}>{es ? "Quitar" : "Remove"}</button>}
          </div>
          <p className="text-[11px] text-muted">{es ? "Recibe los créditos del plan cada mes y su calidad de IA, hasta la fecha. Al quitarlo se retiran los créditos del mes que le queden." : "They get the plan's credits every month and its AI quality, until the end date. Removing it takes back what's left of this month's gift credits."}</p>
        </>
      )}
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}

/** Admin: permanently delete this account (tap, then confirm). */
export function DeleteUser({ userId, email, es }: { userId: string; email: string; es: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function del() {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setBusy(false);
    if (r.ok) {
      router.push("/admin/users");
      router.refresh();
    } else setErr((await r.json().catch(() => ({}))).error === "confirm_email" ? (es ? "El correo no coincide." : "The email doesn't match.") : es ? "No se pudo borrar." : "Couldn't delete.");
  }
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-danger/50 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/10">
        🗑️ {es ? "Borrar cuenta" : "Delete account"}
      </button>
    );
  return (
    <div className="w-full space-y-2 rounded-xl border border-danger/50 bg-danger/5 p-3 text-sm">
      <p className="font-bold text-danger">{es ? "¿Borrar esta cuenta para siempre?" : "Delete this account forever?"}</p>
      <p className="text-xs text-muted">
        {es
          ? "Se borran sus pósters, videos, créditos, historial, equipos guardados y tickets. Si tiene suscripción pagada se cancela. No se puede deshacer."
          : "Their posters, videos, credits, history, saved teams and tickets are deleted. A paid subscription is cancelled. This can't be undone."}
      </p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={del} className="btn-danger flex-1 py-2 text-sm">
          {busy ? "…" : es ? "Borrar para siempre" : "Delete forever"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2 text-sm">{es ? "Cancelar" : "Cancel"}</button>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
