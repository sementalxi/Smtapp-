"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import type { PricingConfig } from "@/lib/pricing";

/** On/off switch: on = shown on the pricing page and buyable. */
function Toggle({ on, onChange, es }: { on: boolean; onChange: (v: boolean) => void; es: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition ${on ? "border-lime/60 bg-lime/10 text-lime" : "border-line text-muted"}`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? "bg-lime" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
      {on ? (es ? "Activo" : "Active") : es ? "Oculto" : "Hidden"}
    </button>
  );
}

/** Admin: edit credit packs and monthly plans (credits, price, "popular" badge). */
export function PricingEditor({ initial }: { initial: PricingConfig }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [cfg, setCfg] = useState<PricingConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const setPack = (i: number, patch: Partial<PricingConfig["packs"][number]>) => {
    setCfg((c) => ({ ...c, packs: c.packs.map((p, n) => (n === i ? { ...p, ...patch } : p)) }));
    setMsg("");
  };
  const setPlan = (i: number, patch: Partial<PricingConfig["plans"][number]>) => {
    setCfg((c) => ({ ...c, plans: c.plans.map((p, n) => (n === i ? { ...p, ...patch } : p)) }));
    setMsg("");
  };

  async function send(method: "PUT" | "DELETE") {
    if (method === "DELETE" && !confirmReset()) return;
    setBusy(true);
    const res = await fetch("/api/admin/pricing", { method, headers: { "Content-Type": "application/json" }, body: method === "PUT" ? JSON.stringify(cfg) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.pricing) {
      setCfg(data.pricing);
      setMsg(es ? "✅ Precios guardados — ya se ven en la página de precios" : "✅ Prices saved — live on the pricing page now");
      router.refresh();
    } else setMsg(es ? "❌ Revisa los valores (precio mínimo $0.50)" : "❌ Check the values (minimum price $0.50)");
  }
  // inline confirm without a browser dialog
  const [arm, setArm] = useState(false);
  const confirmReset = () => {
    if (arm) return true;
    setArm(true);
    setMsg(es ? "Toca “Restaurar” otra vez para confirmar" : "Tap “Reset” again to confirm");
    setTimeout(() => setArm(false), 4000);
    return false;
  };

  const per = (price: number, credits: number) => (credits > 0 ? `$${(price / credits).toFixed(2)} ${es ? "por crédito" : "per credit"}` : "");
  const packName: Record<string, string> = es ? { small: "Paquete pequeño", medium: "Paquete mediano", large: "Paquete grande" } : { small: "Small pack", medium: "Medium pack", large: "Large pack" };
  const planName: Record<string, string> = { starter: "Starter", pro: "Pro" };

  return (
    <div className="card space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold">💲 {es ? "Precios y créditos" : "Prices & credits"}</h2>
        <p className="text-sm text-muted">
          {es
            ? "Cambia cuántos créditos y cuánto cuesta cada paquete y plan, y activa u oculta cualquiera (oculto = no se muestra ni se puede comprar). Se actualiza en la página de precios y en el pago (Square/Stripe) al instante. Las suscripciones activas siguen con su precio anterior."
            : "Change how many credits each pack and plan gives and what it costs, and switch any of them on or off (off = hidden and can't be bought). Updates the pricing page and checkout (Square/Stripe) instantly. Active subscriptions keep their old price."}
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-teal">{es ? "Paquetes (pago único)" : "Credit packs (one-time)"}</div>
        <div className="space-y-2">
          {cfg.packs.map((p, i) => (
            <div key={p.id} className={`rounded-xl border p-3 transition ${p.active ? "border-line bg-panel-2/60" : "border-dashed border-line/70 bg-panel/40 opacity-60"}`}>
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">{packName[p.id]}</b>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={p.popular} onChange={(e) => setPack(i, { popular: e.target.checked })} /> ⭐ Popular
                  </label>
                  <Toggle on={p.active} onChange={(v) => setPack(i, { active: v })} es={es} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">{es ? "Créditos" : "Credits"}</span>
                  <input className="input" inputMode="numeric" type="number" min={1} value={p.credits} onChange={(e) => setPack(i, { credits: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="label">{es ? "Precio (USD)" : "Price (USD)"}</span>
                  <input className="input" inputMode="decimal" type="number" min={0.5} step={0.01} value={p.priceUsd} onChange={(e) => setPack(i, { priceUsd: Number(e.target.value) })} />
                </label>
              </div>
              <div className="mt-1 text-[11px] text-muted">{per(p.priceUsd, p.credits)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-teal">{es ? "Planes mensuales" : "Monthly plans"}</div>
        <div className="space-y-2">
          {cfg.plans.map((p, i) => (
            <div key={p.id} className={`rounded-xl border p-3 transition ${p.active ? "border-line bg-panel-2/60" : "border-dashed border-line/70 bg-panel/40 opacity-60"}`}>
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">Plan {planName[p.id]}</b>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={p.popular} onChange={(e) => setPlan(i, { popular: e.target.checked })} /> ⭐ Popular
                  </label>
                  <Toggle on={p.active} onChange={(v) => setPlan(i, { active: v })} es={es} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">{es ? "Créditos / mes" : "Credits / month"}</span>
                  <input className="input" inputMode="numeric" type="number" min={1} value={p.monthlyCredits} onChange={(e) => setPlan(i, { monthlyCredits: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="label">{es ? "Precio / mes (USD)" : "Price / month (USD)"}</span>
                  <input className="input" inputMode="decimal" type="number" min={0.5} step={0.01} value={p.priceUsd} onChange={(e) => setPlan(i, { priceUsd: Number(e.target.value) })} />
                </label>
              </div>
              <div className="mt-1 text-[11px] text-muted">{per(p.priceUsd, p.monthlyCredits)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary px-6" disabled={busy} onClick={() => send("PUT")}>
          {busy ? "…" : es ? "Guardar precios" : "Save prices"}
        </button>
        <button type="button" className="btn-ghost px-4" disabled={busy} onClick={() => send("DELETE")}>
          ↺ {es ? "Restaurar" : "Reset"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
