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

export function AuthForm({ mode, next, phoneRequired, discord, err, discordBonus = 0 }: { mode: "login" | "register"; next?: string; phoneRequired?: boolean; discord?: boolean; err?: string; discordBonus?: number }) {
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
      {discord && (
        <div className="mb-4 space-y-3">
          <a
            href={`/api/auth/discord${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] py-3.5 text-base font-bold text-white shadow-[0_8px_28px_-10px_rgba(88,101,242,0.8)] transition hover:brightness-110"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8.1 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
            </svg>
            {es ? "Continuar con Discord" : "Continue with Discord"}
          </a>
          {mode === "register" && discordBonus > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/10 px-3 py-2 text-sm font-bold">
              <span className="text-lg">🎁</span>
              <span>
                {es ? <>Regístrate con Discord y recibe <span className="text-lime">+{discordBonus} créditos extra</span></> : <>Sign up with Discord and get <span className="text-lime">+{discordBonus} bonus credits</span></>}
              </span>
            </div>
          )}
          {err?.startsWith("discord") && (
            <p className="text-center text-xs text-danger">
              {err === "discord_email"
                ? es ? "Tu cuenta de Discord necesita un email verificado." : "Your Discord account needs a verified email."
                : err === "discord_cancel"
                  ? es ? "Cancelaste el acceso en Discord." : "Discord sign-in was cancelled."
                  : `${es ? "No se pudo entrar con Discord. Inténtalo otra vez." : "Couldn't sign in with Discord. Please try again."} (${err})`}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-line" />
            {es ? "o con email" : "or with email"}
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}
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
        {mode === "login" && (
          <div className="-mt-2 text-right">
            <Link href="/forgot" className="text-xs font-semibold text-lime">{es ? "¿Olvidaste tu contraseña?" : "Forgot password?"}</Link>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        {mode === "register" && (
          <p className="text-[11px] text-muted">{es ? "Podemos enviarte ofertas por correo de vez en cuando. Puedes darte de baja cuando quieras." : "We may email you offers now and then. You can unsubscribe anytime."}</p>
        )}
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
