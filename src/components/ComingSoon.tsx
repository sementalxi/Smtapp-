"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";

const DISCORD = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.4-5.2-.8-9.7-3.4-13.6zM8.7 15.3c-1.2 0-2.1-1-2.1-2.3s.9-2.3 2.1-2.3 2.2 1 2.1 2.3c0 1.2-.9 2.3-2.1 2.3zm6.6 0c-1.2 0-2.1-1-2.1-2.3s.9-2.3 2.1-2.3 2.2 1 2.1 2.3c0 1.2-.9 2.3-2.1 2.3z" />
  </svg>
);

/** Launch page shown to everyone (except admins) while "coming soon" mode is on. */
export function ComingSoon({ user, bonus = 0 }: { user: { name: string; discord: boolean; discordName: string | null } | null; bonus?: number }) {
  const { locale } = useT();
  const es = locale === "es";
  return (
    <div className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kixo-hero-bg.webp" alt="" aria-hidden className="kixo-hero-bg pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-50 [filter:hue-rotate(195deg)_saturate(1.1)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/85 to-ink" />
      <div className="kixo-bg-pan pointer-events-none absolute left-1/2 top-1/3 -z-10 h-72 w-[640px] -translate-x-1/2 rounded-full bg-lime/25 blur-3xl" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kixo-wordmark.png" alt="KIXO" className="kixo-fade-up h-14 w-auto [filter:hue-rotate(246deg)] sm:h-20" />

      <p className="kixo-fade-up mt-8 text-xs font-bold uppercase tracking-[0.4em] text-teal" style={{ animationDelay: "150ms" }}>
        {es ? "Pósters de deportes con IA" : "AI sports posters"}
      </p>
      <h1 className="font-display kixo-fade-up mt-3 text-6xl leading-[0.9] sm:text-8xl" style={{ animationDelay: "250ms" }}>
        <span className="gold-text">{es ? "MUY" : "COMING"}</span>
        <br />
        <span className="lime-text">{es ? "PRONTO" : "SOON"}</span>
      </h1>
      <p className="kixo-fade-up mt-3 text-sm font-bold uppercase tracking-[0.3em] text-muted" style={{ animationDelay: "320ms" }}>
        {es ? "Coming soon" : "Muy pronto"}
      </p>
      <div className="kixo-glow mx-auto mt-6 h-1 w-24 rounded-full bg-lime" />

      <div className="kixo-fade-up mt-8 w-full max-w-md" style={{ animationDelay: "420ms" }}>
        {!user ? (
          <>
            <p className="text-base text-white/80">
              {es
                ? "Crea tu cuenta con Discord ahora y sé de los primeros en entrar cuando abramos."
                : "Create your account with Discord now and be one of the first in when we open."}
            </p>
            <a href="/api/auth/discord" className="kixo-shine mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#5865F2] px-6 py-4 text-base font-extrabold text-white shadow-[0_14px_40px_-12px_rgba(88,101,242,0.9)] transition hover:brightness-110">
              {DISCORD} {es ? "Crear cuenta con Discord" : "Sign up with Discord"}
            </a>
            {bonus > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 py-2.5 text-sm font-bold">
                <span className="text-lg">🎁</span>
                <span>
                  {es ? "Regístrate y recibe " : "Sign up and get "}
                  <span className="lime-text font-extrabold">+{bonus} {es ? "créditos extra" : "bonus credits"}</span>
                </span>
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              {es ? "¿Ya tienes cuenta? " : "Already have an account? "}
              <Link href="/login" className="font-bold text-lime hover:text-white">{es ? "Inicia sesión" : "Log in"}</Link>
            </p>
          </>
        ) : !user.discord ? (
          <>
            <p className="text-base text-white/80">
              {es ? `¡Hola ${user.name}! Tu cuenta está lista. ` : `Hey ${user.name}! Your account is ready. `}
              <b className="text-white">{es ? "Conecta tu Discord" : "Connect your Discord"}</b>
              {es ? " para recibir tu rol y las novedades del lanzamiento." : " to get your role and the launch news."}
            </p>
            <a href="/api/auth/discord?link=1" className="kixo-shine mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#5865F2] px-6 py-4 text-base font-extrabold text-white shadow-[0_14px_40px_-12px_rgba(88,101,242,0.9)] transition hover:brightness-110">
              {DISCORD} {es ? "Conectar Discord" : "Connect Discord"}
            </a>
          </>
        ) : (
          <div className="rounded-2xl border border-lime/40 bg-lime/10 p-5">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-lg font-extrabold">{es ? "¡Estás dentro!" : "You're in!"}</p>
            <p className="mt-1 text-sm text-white/75">
              {es
                ? `Tu cuenta está conectada a Discord${user.discordName ? ` (${user.discordName})` : ""}. Te avisaremos en el servidor cuando abramos.`
                : `Your account is linked to Discord${user.discordName ? ` (${user.discordName})` : ""}. We'll let you know in the server when we open.`}
            </p>
          </div>
        )}
        {user && (
          <form action="/api/auth/logout" method="post" className="mt-5">
            <button className="text-xs font-bold text-muted underline-offset-4 hover:text-white hover:underline">{es ? "Cerrar sesión" : "Log out"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
