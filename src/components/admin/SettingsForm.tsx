"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";

export function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const { t, locale } = useT();
  const es = locale === "es";
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState("");

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
      <div className="rounded-xl border border-line bg-panel-2 p-4">
        <label className="label">{es ? "Imágenes de la página principal" : "Home page images"}</label>
        <div className="grid grid-cols-3 gap-2">
          {(["hero_1", "hero_2", "hero_3"] as const).map((k, n) => (
            <ImageDrop
              key={k}
              noSearch
              kind="photo"
              label={es ? ["Izquierda", "Centro", "Derecha"][n] : ["Left", "Center", "Right"][n]}
              value={v[k] || null}
              onChange={(url) => setV({ ...v, [k]: url ?? "" })}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          {es
            ? "Las 3 imágenes grandes de la página principal. Vacías = se muestran los primeros estilos. También puedes enviar cualquier póster aquí desde su página. Luego toca Guardar."
            : "The 3 big pictures on the home page. Empty = the first styles are shown. You can also send any poster here from its page. Then tap Save."}
        </p>
      </div>
      <div className="rounded-xl border border-line bg-panel-2 p-4">
        <label className="label">{es ? "Registro en Discord (webhook)" : "Discord log (webhook)"}</label>
        <input
          className="input"
          placeholder="https://discord.com/api/webhooks/…"
          value={v.discord_webhook ?? ""}
          onChange={(e) => setV({ ...v, discord_webhook: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted">
          {es
            ? "Cada póster creado (y cada error) se publica en tu canal de Discord con la imagen, quién lo hizo y los créditos. En Discord: Ajustes del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL."
            : "Every poster made (and every failure) is posted to your Discord channel with the image, who made it and the credits. In Discord: Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL."}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-xs"
            disabled={!v.discord_webhook}
            onClick={async () => {
              setTest("…");
              const res = await fetch("/api/admin/discord-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: v.discord_webhook }),
              });
              setTest(res.ok ? (es ? "✅ Mensaje enviado — revisa Discord" : "✅ Sent — check Discord") : es ? "❌ No funcionó — revisa la URL" : "❌ Didn't work — check the URL");
            }}
          >
            {es ? "Enviar prueba" : "Send test"}
          </button>
          {test && <span className="text-xs">{test}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="btn-primary">{t("save")}</button>
        {msg && <span className="text-sm text-lime">{msg}</span>}
      </div>
    </form>
  );
}
