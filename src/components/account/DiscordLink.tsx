"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const Logo = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
    <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a12.9 12.9 0 0 1-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8.1 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7.8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
  </svg>
);

/** Profile card: connect / disconnect Discord. */
export function DiscordLink({ linked, name, es, status }: { linked: boolean; name: string | null; es: boolean; status?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const msg =
    status === "linked" ? (es ? "✅ Discord conectado" : "✅ Discord connected")
    : status === "taken" ? (es ? "❌ Esa cuenta de Discord ya está conectada a otra cuenta de KIXO." : "❌ That Discord account is already linked to another KIXO account.")
    : "";

  async function unlink() {
    setBusy(true);
    await fetch("/api/account/discord", { method: "DELETE" });
    setBusy(false);
    setConfirm(false);
    router.replace("/profile");
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-5 py-3 font-bold">{es ? "Cuentas conectadas" : "Connected accounts"}</div>
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5865F2] text-white shadow-[0_8px_24px_-10px_rgba(88,101,242,0.9)]">
            <Logo />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">Discord</div>
            <div className="truncate text-xs text-muted">
              {linked ? (
                <span className="text-teal">● {name ? (es ? `Conectado como ${name}` : `Connected as ${name}`) : es ? "Conectado" : "Connected"}</span>
              ) : es ? "Entra con un toque usando Discord" : "Log in with one tap using Discord"}
            </div>
          </div>
          {linked ? (
            <button type="button" onClick={() => setConfirm(true)} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-bold text-muted transition hover:border-danger/60 hover:text-danger">
              {es ? "Desconectar" : "Disconnect"}
            </button>
          ) : (
            <a href="/api/auth/discord?link=1" className="shrink-0 rounded-lg bg-[#5865F2] px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110">
              {es ? "Conectar" : "Connect"}
            </a>
          )}
        </div>
        {confirm && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs">
            <p className="text-muted">{es ? "¿Desconectar Discord? Ya no podrás entrar con Discord hasta que lo vuelvas a conectar." : "Disconnect Discord? You won't be able to log in with Discord until you connect it again."}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={unlink} className="rounded-lg bg-danger px-3 py-1.5 font-bold text-white">{busy ? "…" : es ? "Sí, desconectar" : "Yes, disconnect"}</button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-line px-3 py-1.5 font-bold text-muted">{es ? "Cancelar" : "Cancel"}</button>
            </div>
          </div>
        )}
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    </div>
  );
}
