"use client";

import Link from "next/link";
import { useState } from "react";

export function ForgotForm({ es }: { es: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ discord: boolean; email: boolean } | null>(null);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(d.ways ?? { discord: false, email: false });
    else setErr(r.status === 429 ? (es ? "Demasiados intentos, espera un poco." : "Too many tries, wait a bit.") : es ? "Revisa el email." : "Check the email.");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="font-display mb-2 text-4xl">{es ? "¿Olvidaste tu contraseña?" : "Forgot password?"}</h1>
      <p className="mb-6 text-sm text-muted">{es ? "Te enviamos un enlace para crear una nueva." : "We'll send you a link to set a new one."}</p>
      {done ? (
        <div className="card space-y-3 p-6 text-sm">
          <p className="font-bold">✅ {es ? "Si existe una cuenta con ese email, te enviamos el enlace:" : "If an account exists for that email, we sent the link:"}</p>
          <ul className="space-y-1 text-muted">
            {done.discord && <li>💬 {es ? "por mensaje directo de Discord (si tu cuenta está conectada)" : "by Discord DM (if your account is linked)"}</li>}
            {done.email && <li>✉️ {es ? "por email (revisa spam)" : "by email (check spam)"}</li>}
            {!done.discord && !done.email && <li>{es ? "⚠️ El envío no está configurado aún. Entra con Discord o contacta soporte." : "⚠️ Sending isn't set up yet. Log in with Discord or contact support."}</li>}
          </ul>
          <p className="text-xs text-muted">{es ? "El enlace vence en 30 minutos." : "The link expires in 30 minutes."}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : es ? "Enviar enlace" : "Send link"}</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="text-lime">← {es ? "Volver a entrar" : "Back to log in"}</Link>
      </p>
    </div>
  );
}

export function ResetForm({ es, token }: { es: boolean; token: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setErr(es ? "Mínimo 8 caracteres" : "At least 8 characters");
    if (pw !== pw2) return setErr(es ? "Las contraseñas no coinciden" : "Passwords don't match");
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, password: pw }) });
    setBusy(false);
    if (r.ok) window.location.href = "/dashboard";
    else setErr(es ? "El enlace venció o ya se usó. Pide uno nuevo." : "This link expired or was already used. Ask for a new one.");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="font-display mb-6 text-4xl">{es ? "Nueva contraseña" : "New password"}</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="pw">{es ? "Contraseña nueva" : "New password"}</label>
          <input id="pw" type="password" required minLength={8} className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw2">{es ? "Repítela" : "Repeat it"}</label>
          <input id="pw2" type="password" required minLength={8} className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {err && (
          <p className="text-sm text-danger">
            {err} {err.includes("venció") || err.includes("expired") ? <Link href="/forgot" className="underline">{es ? "Pedir otro" : "Get a new one"}</Link> : null}
          </p>
        )}
        <button className="btn-primary w-full" disabled={busy || !token}>{busy ? "…" : es ? "Guardar y entrar" : "Save and log in"}</button>
      </form>
    </div>
  );
}
