"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`card overflow-hidden ${danger ? "border-danger/40" : ""}`}>
      <div className={`border-b px-5 py-3 font-bold ${danger ? "border-danger/30 text-danger" : "border-line"}`}>{title}</div>
      <div className="space-y-3 p-5">{children}</div>
    </div>
  );
}

export function ProfileForms({ name: initialName, email, isAdmin }: { name: string; email: string; isAdmin: boolean }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nameMsg, setNameMsg] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [del, setDel] = useState({ open: false, password: "", typed: "" });
  const [delMsg, setDelMsg] = useState("");
  const [busy, setBusy] = useState("");

  async function saveName() {
    setBusy("name");
    const r = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusy("");
    setNameMsg(r.ok ? (es ? "✅ Guardado" : "✅ Saved") : es ? "❌ No se pudo guardar" : "❌ Couldn't save");
    if (r.ok) router.refresh();
  }
  async function savePw() {
    if (pw.next.length < 8) return setPwMsg(es ? "La nueva contraseña necesita al menos 8 caracteres" : "New password needs at least 8 characters");
    if (pw.next !== pw.confirm) return setPwMsg(es ? "Las contraseñas no coinciden" : "Passwords don't match");
    setBusy("pw");
    const r = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: pw.current, next: pw.next }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (r.ok) {
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg(es ? "✅ Contraseña cambiada" : "✅ Password changed");
    } else setPwMsg(d.error === "wrong_password" ? (es ? "❌ La contraseña actual no es correcta" : "❌ Current password is wrong") : es ? "❌ No se pudo cambiar" : "❌ Couldn't change it");
  }
  async function deleteAccount() {
    setBusy("del");
    const r = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: del.password }) });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (r.ok) window.location.href = "/";
    else setDelMsg(d.error === "wrong_password" ? (es ? "❌ Contraseña incorrecta" : "❌ Wrong password") : es ? "❌ No se pudo eliminar" : "❌ Couldn't delete");
  }

  const word = es ? "ELIMINAR" : "DELETE";

  return (
    <div className="space-y-5">
      <Section title={es ? "Información personal" : "Personal info"}>
        <div>
          <label className="label">{es ? "Nombre" : "Name"}</label>
          <input className="input" maxLength={60} value={name} onChange={(e) => { setName(e.target.value); setNameMsg(""); }} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60" value={email} disabled />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary px-5 py-2" disabled={busy === "name" || !name.trim() || name === initialName} onClick={saveName}>
            {busy === "name" ? "…" : es ? "Guardar cambios" : "Save changes"}
          </button>
          {nameMsg && <span className="text-sm">{nameMsg}</span>}
        </div>
      </Section>

      <Section title={es ? "Cambiar contraseña" : "Change password"}>
        {(
          [
            ["current", es ? "Contraseña actual" : "Current password", "current-password"],
            ["next", es ? "Nueva contraseña" : "New password", "new-password"],
            ["confirm", es ? "Confirmar nueva contraseña" : "Confirm new password", "new-password"],
          ] as const
        ).map(([k, label, ac]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <input type="password" autoComplete={ac} className="input" value={pw[k]} onChange={(e) => { setPw({ ...pw, [k]: e.target.value }); setPwMsg(""); }} />
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary px-5 py-2" disabled={busy === "pw" || !pw.current || !pw.next} onClick={savePw}>
            {busy === "pw" ? "…" : es ? "Cambiar contraseña" : "Change password"}
          </button>
          {pwMsg && <span className="text-sm">{pwMsg}</span>}
        </div>
      </Section>

      {!isAdmin && (
        <Section danger title={es ? "Zona de peligro" : "Danger zone"}>
          <p className="text-sm text-muted">
            {es ? "Elimina tu cuenta, tus artes y tus créditos para siempre. No se puede deshacer." : "Permanently delete your account, your arts and your credits. This can't be undone."}
          </p>
          {!del.open ? (
            <button type="button" className="rounded-xl border border-danger/60 px-4 py-2 text-sm font-bold text-danger hover:bg-danger/10" onClick={() => setDel({ ...del, open: true })}>
              {es ? "Eliminar cuenta" : "Delete account"}
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
              <div>
                <label className="label">{es ? `Escribe ${word} para confirmar` : `Type ${word} to confirm`}</label>
                <input className="input" value={del.typed} onChange={(e) => setDel({ ...del, typed: e.target.value })} />
              </div>
              <div>
                <label className="label">{es ? "Tu contraseña" : "Your password"}</label>
                <input type="password" autoComplete="current-password" className="input" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busy === "del" || del.typed.trim().toUpperCase() !== word || !del.password} onClick={deleteAccount}>
                  {busy === "del" ? "…" : es ? "Eliminar para siempre" : "Delete forever"}
                </button>
                <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={() => setDel({ open: false, password: "", typed: "" })}>
                  {es ? "Cancelar" : "Cancel"}
                </button>
                {delMsg && <span className="text-sm">{delMsg}</span>}
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
