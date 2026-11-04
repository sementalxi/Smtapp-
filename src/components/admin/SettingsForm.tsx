"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";
import { AdminSection } from "./AdminSection";

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
    <form onSubmit={save} className="max-w-xl space-y-3">
      <AdminSection icon="⚡" title={es ? "Créditos e IA" : "Credits & AI"} sub={es ? "Créditos al registrarse, precio del póster, calidad IA, video IA" : "Sign-up credits, poster price, AI quality, AI video"} open>
      <div>
        <label className="label">{t("signup_credits")}</label>
        <input type="number" min={0} className="input" value={v.signup_credits} onChange={(e) => setV({ ...v, signup_credits: e.target.value })} />
      </div>
      <div>
        <label className="label">🔗 {es ? "Enlace de invitación a tu servidor de Discord" : "Your Discord server invite link"}</label>
        <input className="input" placeholder="https://discord.gg/xxxxx" value={v.discord_server ?? ""} onChange={(e) => setV({ ...v, discord_server: e.target.value })} />
        <p className="mb-4 mt-1 text-xs text-muted">{es ? "Aparece en el pie de página y en el menú para que la gente se una a tu comunidad." : "Shown in the footer and the menu so people can join your community."}</p>
        <label className="label">{es ? "Créditos extra al registrarse con Discord" : "Extra credits for signing up with Discord"}</label>
        <input type="number" min={0} className="input" value={v.discord_bonus} onChange={(e) => setV({ ...v, discord_bonus: e.target.value })} />
      </div>
      <div>
        <label className="label">{es ? "Créditos por invitar (cuando el invitado paga)" : "Invite reward credits (when the invited friend pays)"}</label>
        <input type="number" min={0} className="input" value={v.referral_reward} onChange={(e) => setV({ ...v, referral_reward: e.target.value })} />
      </div>
      <div>
        <label className="label">{t("pro_cost_label")}</label>
        <input type="number" min={0} className="input" value={v.pro_cost} onChange={(e) => setV({ ...v, pro_cost: e.target.value })} />
      </div>
      <div>
        <label className="label">{es ? "Calidad IA Pro (usuarios sin suscripción)" : "Pro AI quality (users without a subscription)"}</label>
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
      <div className="rounded-xl border border-lime/40 bg-panel-2 p-4">
        <label className="label">🎨 {es ? "Generador de pósters" : "Poster generator"}</label>
        <select className="input" value={v.poster_model ?? "mix3"} onChange={(e) => setV({ ...v, poster_model: e.target.value })}>
          <option value="mix3">{es ? "⭐ Los 3: Nano Banana arte + FLUX.2 realismo + OpenAI texto (el mejor)" : "⭐ All 3: Nano Banana art + FLUX.2 realism + OpenAI text (best)"}</option>
          <option value="seedream-mix">{es ? "🆕 Seedream Mix: Seedream 5 arte + FLUX.2 realismo + OpenAI texto" : "🆕 Seedream Mix: Seedream 5 art + FLUX.2 realism + OpenAI text"}</option>
          <option value="mix">{es ? "Mix: Nano Banana arte + OpenAI texto (más rápido)" : "Mix: Nano Banana art + OpenAI text (faster)"}</option>
          <option value="flux-mix">{es ? "Mix FLUX: FLUX.2 Pro arte + OpenAI texto (muy realista)" : "FLUX Mix: FLUX.2 Pro art + OpenAI text (very realistic)"}</option>
          <option value="flux">{es ? "Solo FLUX.2 Pro" : "FLUX.2 Pro only"}</option>
          <option value="openai">{es ? "Solo OpenAI GPT Image (sigue tu texto exacto)" : "OpenAI GPT Image only (follows your exact text)"}</option>
          <option value="nano-pro">{es ? "Nano Banana Pro de Google (puede agregar palabras propias)" : "Google Nano Banana Pro (may add its own words)"}</option>
        </select>
        <p className="mt-2 text-xs text-muted">
          {es
            ? "Pósters nuevos: el que elijas aquí. Las ediciones (“Editar este diseño”) siempre usan Nano Banana Pro porque mantiene la misma imagen. Nano Banana usa tu saldo de fal.ai."
            : "New posters: the one you pick here. Edits (“Edit this design”) always use Nano Banana Pro because it keeps the same image. Nano Banana uses your fal.ai balance."}
        </p>
      </div>
      <div className="rounded-xl border border-fuchsia-400/40 bg-panel-2 p-4">
        <label className="label">✨ {es ? "Video con IA (Kling 3.0)" : "AI video (Kling 3.0)"}</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Encendido" : "On"}</span>
            <select className="input" value={v.video_on ?? "1"} onChange={(e) => setV({ ...v, video_on: e.target.value })}>
              <option value="1">{es ? "Sí" : "Yes"}</option>
              <option value="0">{es ? "No (ocultar)" : "No (hide)"}</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Calidad" : "Quality"}</span>
            <select className="input" value={v.video_model ?? "kling-std"} onChange={(e) => setV({ ...v, video_model: e.target.value })}>
              <option value="kling-std">{es ? "Kling 3.0 (recomendado, ~$0.08–0.13/seg)" : "Kling 3.0 (recommended, ~$0.08–0.13/sec)"}</option>
              <option value="kling-pro">{es ? "Kling 3.0 Pro (mejor, más caro)" : "Kling 3.0 Pro (better, pricier)"}</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Créditos · video de 5 seg" : "Credits · 5-second video"}</span>
            <input type="number" min={0} className="input" value={v.video_cost_5 ?? "10"} onChange={(e) => setV({ ...v, video_cost_5: e.target.value })} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Créditos · video de 10 seg" : "Credits · 10-second video"}</span>
            <input type="number" min={0} className="input" value={v.video_cost_10 ?? "18"} onChange={(e) => setV({ ...v, video_cost_10: e.target.value })} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Créditos extra · con sonido" : "Extra credits · with sound"}</span>
            <input type="number" min={0} className="input" value={v.video_cost_audio ?? "5"} onChange={(e) => setV({ ...v, video_cost_audio: e.target.value })} />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{es ? "Necesita FAL_KEY en Vercel (fal.ai → API Keys). Los videos fallidos se reembolsan solos." : "Needs FAL_KEY on Vercel (fal.ai → API Keys). Failed videos are refunded automatically."}</p>
      </div>
      </AdminSection>
      <AdminSection icon="🏠" title={es ? "Página principal y vista previa" : "Home page & link preview"} sub={es ? "Imágenes, título del sitio, descripción, imagen al compartir" : "Home images, site title, description, share picture"}>
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
      <div className="rounded-xl border border-lime/40 bg-panel-2 p-4">
        <label className="label">🔗 {es ? "Vista previa del enlace (Google, Discord, WhatsApp, iMessage…)" : "Link preview (Google, Discord, WhatsApp, iMessage…)"}</label>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Título del sitio" : "Website title"}</span>
            <input className="input" maxLength={80} placeholder="KIXO — AI sports banners" value={v.site_title ?? ""} onChange={(e) => setV({ ...v, site_title: e.target.value })} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-muted">{es ? "Descripción" : "Description"}</span>
            <textarea className="input min-h-[70px]" maxLength={300} placeholder="Create pro sports and eSports banners with AI in seconds." value={v.site_description ?? ""} onChange={(e) => setV({ ...v, site_description: e.target.value })} />
          </div>
          <div className="max-w-[260px]">
            <ImageDrop noSearch kind="photo" label={es ? "Imagen / banner (1200×630 ideal)" : "Picture / banner (1200×630 is ideal)"} value={v.share_image || null} onChange={(url) => setV({ ...v, share_image: url ?? "" })} />
          </div>
          {/* Live preview — roughly how Discord shows it */}
          <div className="overflow-hidden rounded-lg border-l-4 border-[#ff2e88] bg-[#2b2d31] p-3 text-left">
            <div className="text-[11px] text-white/60">kixo.pro</div>
            <div className="mt-0.5 text-sm font-bold text-[#00a8fc]">{v.site_title?.trim() || "KIXO — AI sports banners"}</div>
            <div className="mt-1 text-xs text-white/80">{v.site_description?.trim() || "Create pro sports and eSports banners with AI in seconds."}</div>
            {v.share_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.share_image} alt="" className="mt-2 max-h-48 w-full rounded object-cover" />
            )}
          </div>
          <p className="text-xs text-muted">
            {es
              ? "Toca Guardar abajo. Discord y WhatsApp guardan la vista previa vieja un rato — al compartir de nuevo puede tardar en cambiar (o agrega ?v=2 al final del link)."
              : "Tap Save below. Discord and WhatsApp keep the old preview for a while — it can take time to update (or add ?v=2 to the end of the link when sharing)."}
          </p>
        </div>
      </div>
      </AdminSection>
      <AdminSection icon="🔔" title={es ? "Aviso y registro de Discord" : "Notice bar & Discord log"} sub={es ? "Mensaje arriba en todas las páginas, webhook de pósters" : "Message at the top of every page, poster log webhook"}>
      <div>
        <label className="label">{t("maintenance_message")}</label>
        <input className="input" maxLength={300} value={v.maintenance_message} onChange={(e) => setV({ ...v, maintenance_message: e.target.value })} />
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
      </AdminSection>
      <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur">
        <button disabled={busy} className="btn-primary">{t("save")}</button>
        {msg && <span className="text-sm text-lime">{msg}</span>}
      </div>
    </form>
  );
}
