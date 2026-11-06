"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { COUNTRIES, PhoneUsedNotice } from "./AuthForm";

/** Asks a new account for its phone number once (it can't be changed afterwards) and continues. */
export function PhoneStep({ next, discordServer }: { next: string; discordServer?: string }) {
  const { locale } = useT();
  const es = locale === "es";
  const [cc, setCc] = useState("+1");
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/account/phone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: cc + num }) });
    if (r.ok) {
      window.location.href = next;
      return;
    }
    const d = await r.json().catch(() => ({}));
    setError(
      d.error === "err_phone_used"
        ? <PhoneUsedNotice es={es} discordServer={discordServer} />
        : d.error === "err_phone_invalid"
          ? es ? "Número de teléfono no válido." : "That phone number isn't valid."
          : es ? "No se pudo guardar. Inténtalo otra vez." : "Couldn't save it. Try again.",
    );
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="font-display mb-2 text-4xl">{es ? "Tu teléfono" : "Your phone number"}</h1>
      <p className="mb-6 text-sm text-muted">
        {es ? "Un paso más: cada cuenta necesita un número de teléfono (una cuenta por número). No se puede cambiar después." : "One more step: every account needs a phone number (one account per number). It can't be changed later."}
      </p>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="phone">{es ? "Teléfono" : "Phone number"}</label>
          <div className="flex gap-2">
            <select className="input w-[6.5rem] shrink-0 px-2" value={cc} onChange={(e) => setCc(e.target.value)} aria-label={es ? "Código de país" : "Country code"}>
              {COUNTRIES.map(([v, l]) => (
                <option key={v + l} value={v}>{l}</option>
              ))}
            </select>
            <input id="phone" className="input min-w-0 flex-1" type="tel" inputMode="tel" autoComplete="tel-national" required placeholder="512 555 0100" value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={busy || num.replace(/\D/g, "").length < 7} className="btn-primary w-full">
          {busy ? "…" : es ? "Continuar" : "Continue"}
        </button>
      </form>
    </div>
  );
}
