"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";

const COUNTRIES = [
  ["+1", "🇺🇸 +1"], ["+52", "🇲🇽 +52"], ["+34", "🇪🇸 +34"], ["+57", "🇨🇴 +57"], ["+54", "🇦🇷 +54"], ["+56", "🇨🇱 +56"], ["+51", "🇵🇪 +51"],
  ["+58", "🇻🇪 +58"], ["+593", "🇪🇨 +593"], ["+502", "🇬🇹 +502"], ["+503", "🇸🇻 +503"], ["+504", "🇭🇳 +504"], ["+505", "🇳🇮 +505"],
  ["+506", "🇨🇷 +506"], ["+507", "🇵🇦 +507"], ["+591", "🇧🇴 +591"], ["+595", "🇵🇾 +595"], ["+598", "🇺🇾 +598"], ["+55", "🇧🇷 +55"], ["+44", "🇬🇧 +44"],
] as const;

export function AuthForm({ mode, next, phoneRequired }: { mode: "login" | "register"; next?: string; phoneRequired?: boolean }) {
  const { t, locale } = useT();
  const es = locale === "es";
  const [cc, setCc] = useState("+1");
  const [num, setNum] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState("");
  const phoneErr = (e: string) =>
    e === "err_phone_used"
      ? es ? "Este número ya tiene una cuenta. Inicia sesión." : "This number already has an account. Log in instead."
      : e === "err_phone_invalid"
        ? es ? "Número no válido." : "That phone number isn't valid."
        : e === "err_code"
          ? es ? "Código incorrecto o vencido." : "Wrong or expired code."
          : e === "err_phone_send"
            ? es ? "No pudimos enviar el SMS. Revisa el número." : "We couldn't send the text. Check the number."
            : "";
  async function sendSms() {
    setSending(true);
    setPhoneMsg("");
    const r = await fetch("/api/auth/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: cc + num }) });
    const d = await r.json().catch(() => ({}));
    setSending(false);
    if (r.ok) {
      setSent(true);
      setPhoneMsg(es ? "✅ Código enviado por SMS" : "✅ Code sent by text");
    } else setPhoneMsg(phoneErr(d.error) || t("err_generic"));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "register" && phoneRequired) {
      data.phone = cc + num;
      data.code = code;
    }
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : mode === "register" ? "/create" : "/dashboard";
      window.location.href = dest;
      return;
    }
    const body = await res.json().catch(() => ({}));
    const known: DictKey[] = ["err_invalid", "err_exists", "err_banned"];
    setError(phoneErr(body.error) || t(known.includes(body.error) ? (body.error as DictKey) : "err_generic"));
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="font-display mb-6 text-4xl">{t(mode === "login" ? "login_title" : "register_title")}</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">{t("name")}</label>
            <input id="name" name="name" required maxLength={60} className="input" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">{t("email")}</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            className="input"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder={mode === "register" ? t("pw_hint") : ""}
          />
        </div>
        {mode === "register" && phoneRequired && (
          <div className="space-y-2 rounded-xl border border-teal/30 bg-teal/5 p-3">
            <label className="label">{es ? "Teléfono (verificación por SMS)" : "Phone (SMS verification)"}</label>
            <div className="flex gap-2">
              <select className="input w-[6.5rem] shrink-0 px-2" value={cc} onChange={(e) => { setCc(e.target.value); setSent(false); }}>
                {COUNTRIES.map(([v, l]) => (
                  <option key={v + l} value={v}>{l}</option>
                ))}
              </select>
              <input className="input min-w-0 flex-1" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="512 555 0100" value={num} onChange={(e) => { setNum(e.target.value); setSent(false); }} />
            </div>
            <button type="button" className="btn-ghost w-full py-2 text-sm" disabled={sending || num.replace(/\D/g, "").length < 7} onClick={sendSms}>
              {sending ? "…" : sent ? (es ? "Reenviar código" : "Resend code") : es ? "📲 Enviar código" : "📲 Send code"}
            </button>
            {sent && (
              <input className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            )}
            {phoneMsg && <p className="text-xs">{phoneMsg}</p>}
            <p className="text-[11px] text-muted">{es ? "Una cuenta por número. También te enviaremos tus pósters por mensaje." : "One account per number. We'll also text you your posters."}</p>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={busy || (mode === "register" && phoneRequired && (!sent || code.length < 4))} className="btn-primary w-full">
          {busy ? "…" : t(mode === "login" ? "nav_login" : "nav_register")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            {t("no_account")} <Link href="/register" className="text-lime">{t("nav_register")}</Link>
          </>
        ) : (
          <>
            {t("have_account")} <Link href="/login" className="text-lime">{t("nav_login")}</Link>
          </>
        )}
      </p>
    </div>
  );
}
