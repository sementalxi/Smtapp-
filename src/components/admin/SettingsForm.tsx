"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const { t, locale } = useT();
  const es = locale === "es";
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    setMsg(res.ok ? t("saved_ok") : t("err_generic"));
  }

  return (
    <form onSubmit={save} className="card max-w-xl space-y-4 p-6">
      <div>
        <label className="label">{t("signup_credits")}</label>
        <input type="number" min={0} className="input" value={v.signup_credits} onChange={(e) => setV({ ...v, signup_credits: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("pro_cost_label")}</label>
        <input type="number" min={0} className="input" value={v.pro_cost} onChange={(e) => setV({ ...v, pro_cost: e.target.value })} />
      </div>
      <div>
        <label className="label">{es ? "Calidad de imagen IA Pro" : "Pro AI image quality"}</label>
        <select className="input" value={v.pro_quality} onChange={(e) => setV({ ...v, pro_quality: e.target.value })}>
          <option value="medium">{es ? "Media — ~1 minuto, más barata (recomendada)" : "Medium — about 1 minute, cheaper (recommended)"}</option>
          <option value="high">{es ? "Alta — máximo detalle, 2–4 minutos, ~3× más cara por imagen" : "High — sharpest detail, 2–4 minutes, costs ~3× more per image"}</option>
          <option value="low">{es ? "Baja — la más rápida, para pruebas" : "Low — fastest, for testing"}</option>
        </select>
        <p className="mt-1 text-xs text-muted">{es ? "Alta a veces llega al límite de 5 minutos del servidor; las imágenes fallidas se reembolsan solas." : "High can occasionally hit the 5-minute server limit; failed images are refunded automatically."}</p>
      </div>
      <div>
        <label className="label">{t("max_upload_mb")}</label>
        <input type="number" min={1} max={50} className="input" value={v.max_upload_mb} onChange={(e) => setV({ ...v, max_upload_mb: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("maintenance_message")}</label>
        <input className="input" maxLength={300} value={v.maintenance_message} onChange={(e) => setV({ ...v, maintenance_message: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="btn-primary">{t("save")}</button>
        {msg && <span className="text-sm text-lime">{msg}</span>}
      </div>
    </form>
  );
}
