"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

/** Inline credit buttons + ban/admin toggles for one user card. */
export function UserQuick({
  userId,
  credits: initial,
  role,
  banned,
  self,
}: {
  userId: string;
  credits: number;
  role: string;
  banned: boolean;
  self: boolean;
}) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [credits, setCredits] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [flash, setFlash] = useState("");

  async function give(n: number) {
    if (!Number.isInteger(n) || n === 0) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: n }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setCredits(data.balance);
      setFlash(n > 0 ? `+${n}` : `${n}`);
      setTimeout(() => setFlash(""), 1600);
      setCustom(false);
      setAmount("");
    } else setFlash(es ? "Error" : "Error");
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{es ? "Créditos" : "Credits"}</div>
          <div className="relative text-3xl font-extrabold text-lime">
            {credits}
            {flash && <span className="absolute -top-3 left-full ml-1 animate-bounce text-sm text-white">{flash}</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          {[5, 10, 25].map((n) => (
            <button key={n} disabled={busy} onClick={() => give(n)} className="rounded-lg border border-lime/40 bg-lime/10 px-2.5 py-1.5 text-xs font-bold text-lime transition hover:bg-lime hover:text-ink disabled:opacity-50">
              +{n}
            </button>
          ))}
          <button disabled={busy} onClick={() => setCustom(!custom)} className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs font-bold">
            ±
          </button>
        </div>
      </div>
      {custom && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            give(Math.trunc(Number(amount)));
          }}
        >
          <input
            autoFocus
            type="number"
            className="input py-2"
            placeholder={es ? "ej. 50 o -10" : "e.g. 50 or -10"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button disabled={busy || !amount} className="btn-primary px-3 py-2 text-xs">
            {es ? "Aplicar" : "Apply"}
          </button>
        </form>
      )}
      {!self && (
        <div className="flex gap-2 text-xs">
          <button disabled={busy} onClick={() => patch({ role: role === "ADMIN" ? "USER" : "ADMIN" })} className="text-muted underline-offset-2 hover:text-white hover:underline">
            {role === "ADMIN" ? (es ? "Quitar admin" : "Remove admin") : es ? "Hacer admin" : "Make admin"}
          </button>
          <span className="text-line">|</span>
          <button disabled={busy} onClick={() => patch({ banned: !banned })} className={`underline-offset-2 hover:underline ${banned ? "text-lime" : "text-danger"}`}>
            {banned ? (es ? "Reactivar" : "Unsuspend") : es ? "Suspender" : "Suspend"}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Gift everyone" — add credits to all users at once (two-step confirm). */
export function GiftEveryone({ count }: { count: number }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [amount, setAmount] = useState(10);
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");

  return (
    <div className="card flex flex-wrap items-center gap-3 border-lime/30 bg-gradient-to-r from-lime/10 to-transparent p-4">
      <span className="text-2xl">🎁</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{es ? "Regalar créditos a todos" : "Gift credits to everyone"}</div>
        <div className="text-xs text-muted">
          {step === "done" ? msg : es ? `Suma créditos a los ${count} usuarios activos de una vez.` : `Add credits to all ${count} active users at once.`}
        </div>
      </div>
      <select className="input w-24 py-2" value={amount} onChange={(e) => { setAmount(Number(e.target.value)); setStep("idle"); }}>
        {[4, 8, 10, 20, 50].map((n) => (
          <option key={n} value={n}>
            +{n}
          </option>
        ))}
      </select>
      {step === "confirm" ? (
        <button
          className="btn-primary px-3 py-2 text-xs"
          onClick={async () => {
            setStep("busy");
            const res = await fetch("/api/admin/users/gift", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount }),
            });
            const data = await res.json().catch(() => ({}));
            setMsg(res.ok ? (es ? `✅ ${data.users} usuarios recibieron +${amount}` : `✅ ${data.users} users got +${amount}`) : es ? "❌ Error" : "❌ Failed");
            setStep("done");
            router.refresh();
          }}
        >
          {es ? `¿Seguro? Dar +${amount} a ${count}` : `Sure? Give +${amount} to ${count}`}
        </button>
      ) : (
        <button className="btn-ghost px-3 py-2 text-xs" disabled={step === "busy"} onClick={() => setStep("confirm")}>
          {step === "busy" ? "…" : es ? "Regalar" : "Gift"}
        </button>
      )}
    </div>
  );
}
