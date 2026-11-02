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
  const addPlan = () => {
    setCfg((c) => {
      let n = c.plans.length + 1;
      while (c.plans.some((p) => p.id === `plan${n}`)) n++;
      return { ...c, plans: [...c.plans, { id: `plan${n}`, name: es ? "Nuevo plan" : "New plan", nameEs: "Nuevo plan", features: "", featuresEs: "", monthlyCredits: 200, priceUsd: 29.99, popular: false, active: false, quality: "high" as const }] };
    });
    setMsg("");
  };
  const [delArm, setDelArm] = useState<string | null>(null);
  const removePlan = (i: number) => {
    setCfg((c) => ({ ...c, plans: c.plans.filter((_, n) => n !== i) }));
    setDelArm(null);
    setMsg(es ? "Plan quitado — toca “Guardar precios” para confirmar." : "Plan removed — tap “Save prices” to confirm.");
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
    } else
      setMsg(
        data.error === "plan_has_subscribers"
          ? es ? `❌ “${data.plan}” tiene ${data.count} suscriptor(es) activo(s) — no se puede borrar. Ocúltalo con el interruptor.` : `❌ “${data.plan}” has ${data.count} active subscriber(s) — it can't be deleted. Hide it with the switch instead.`
          : data.error === "duplicate_plan" ? (es ? "❌ Dos planes tienen el mismo código" : "❌ Two plans have the same code")
          : es ? "❌ Revisa los valores (nombre, precio mínimo $0.50, código solo minúsculas/números)" : "❌ Check the values (name, minimum price $0.50, code = lowercase letters/numbers)",
      );
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
                <b className="min-w-0 truncate text-sm">Plan {p.name || p.id}</b>
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
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">{es ? "Nombre (inglés)" : "Name (English)"}</span>
                  <input className="input" maxLength={40} value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">{es ? "Nombre (español)" : "Name (Spanish)"}</span>
                  <input className="input" maxLength={40} value={p.nameEs} onChange={(e) => setPlan(i, { nameEs: e.target.value })} />
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{es ? "Detalles (inglés) — uno por línea" : "Details (English) — one per line"}</span>
                  <textarea className="input min-h-24 text-sm" maxLength={800} placeholder={"All styles\nBest-quality AI\nPriority support"} value={p.features} onChange={(e) => setPlan(i, { features: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">{es ? "Detalles (español) — uno por línea" : "Details (Spanish) — one per line"}</span>
                  <textarea className="input min-h-24 text-sm" maxLength={800} placeholder={"Todos los estilos\nIA de máxima calidad\nSoporte prioritario"} value={p.featuresEs} onChange={(e) => setPlan(i, { featuresEs: e.target.value })} />
                </label>
              </div>
              <div className="mt-3">
                <span className="label">{es ? "IA Pro de este plan" : "Pro AI for this plan"}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ["low", es ? "⚡ Rápida" : "⚡ Fast", es ? "~20 s" : "~20 s"],
                    ["medium", es ? "✨ Estándar" : "✨ Standard", es ? "buena" : "good"],
                    ["high", es ? "💎 Máxima" : "💎 Best", es ? "más detalle" : "most detail"],
                  ] as const).map(([q, l, sub]) => (
                    <button key={q} type="button" onClick={() => setPlan(i, { quality: q })} className={`rounded-lg border px-2 py-2 text-left ${(p.quality ?? "high") === q ? "border-lime bg-lime/10" : "border-line bg-panel"}`}>
                      <span className="block text-xs font-bold">{l}</span>
                      <span className="block text-[10px] text-muted">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted">{es ? "Código" : "Code"}: {p.id}</span>
                {delArm === p.id ? (
                  <button type="button" className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white" onClick={() => removePlan(i)}>{es ? "¿Seguro? Borrar" : "Sure? Delete"}</button>
                ) : (
                  <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-muted hover:text-danger" onClick={() => setDelArm(p.id)}>🗑 {es ? "Borrar plan" : "Delete plan"}</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {cfg.plans.length < 12 && (
          <button type="button" onClick={addPlan} className="mt-2 w-full rounded-xl border-2 border-dashed border-lime/40 bg-lime/5 py-3 text-sm font-bold text-lime hover:border-lime">
            ＋ {es ? "Añadir plan" : "Add plan"}
          </button>
        )}
        <p className="mt-2 text-[11px] text-muted">{es ? "Los planes nuevos empiezan ocultos — actívalos con el interruptor cuando estén listos." : "New plans start hidden — switch them on when they're ready."} </p>
        <p className="mt-2 text-[11px] text-muted">{es ? "Quien no tiene suscripción usa la calidad de Ajustes → “Calidad IA Pro”." : "People without a subscription use the quality in Settings → “Pro AI quality”."}</p>
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
