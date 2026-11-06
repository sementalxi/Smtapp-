"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";
import type { BannerInputs, LayoutKind } from "@/lib/templates";
import { TextFields } from "./TextFields";
import { DownloadSizes } from "./DownloadSizes";
import { AiVideo } from "./AiVideo";
import { waitForBanner } from "@/lib/wait-banner";
import { PosterZoom } from "./PosterZoom";
import { EditDesign } from "./EditDesign";

/** Result page for a Pro AI banner: the finished image, download, and "new version". */
export function ProBannerView({
  id,
  imageUrl,
  inputs: initial,
  layout,
  cost,
  credits,
  title,
  admin,
}: {
  id: string;
  imageUrl: string | null;
  inputs: BannerInputs;
  layout: LayoutKind;
  cost: number;
  credits: number;
  title: string;
  /** Admins can set this poster as a style's sample image. */
  admin?: { templateId: string; templates: { id: string; name: string }[]; prompt?: string | null; hasInstructions?: boolean; templateName?: string; crest?: string };
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [url, setUrl] = useState(imageUrl);
  const [inputs, setInputs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function regenerate() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/banners/${id}/background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs }),
    });
    let data = await res.json().catch(() => ({}));
    if (res.ok && data.pending && data.id) {
      // The new design is a separate poster (the old one stays in the history) — open it when ready.
      const w = await waitForBanner(data.id);
      if (w.ok) {
        router.push(`/banner/${data.id}`);
        return;
      }
      data = { error: w.error, detail: w.detail };
    } else if (res.ok && data.pending) {
      const w = await waitForBanner(id, { previousUrl: data.previousUrl ?? url });
      data = w.ok ? { finalUrl: w.url } : { error: w.error, detail: w.detail };
    }
    if (data.finalUrl) {
      setUrl(data.finalUrl);
      router.refresh();
    } else {
      const known: DictKey[] = ["err_credits", "err_blocked", "err_ai_down"];
      setError(
        (data.error === "err_photo_blocked"
          ? "⚠ " + (locale === "es" ? "El filtro de seguridad rechazó la foto de este póster (créditos devueltos)." : "The AI's safety filter rejected this poster's photo (credits refunded).")
          : t(known.includes(data.error) ? data.error : "err_generic")) + (data.detail ? ` — ${data.detail}` : ""),
      );
    }
    setBusy(false);
  }

  return (
    <div className="grid min-w-0 gap-8 [grid-template-columns:minmax(0,1fr)] lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="card relative overflow-hidden">
          {url ? (
            <PosterZoom src={url} alt={title} className={`block h-auto w-full ${busy ? "opacity-40" : ""}`} />
          ) : (
            <div className="aspect-[4/5] bg-panel-2" />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm font-semibold text-lime">
              {t("pro_wait")}
            </div>
          )}
        </div>
        {url && !busy && (
          <div className="mt-3">
            <AiVideo bannerId={id} title={title} image={url} />
            <div className="mt-2">
              <DownloadSizes src={url} baseName={title} />
            </div>
            {layout === "PLAYER" && (
              <Link href={`/create?match=${id}`} className="btn-primary mt-2 w-full">
                👥 {t("team_set_next")}
              </Link>
            )}
          </div>
        )}
        {admin && url && <SampleSetter bannerId={id} admin={admin} />}
        {admin && (
          <details className="mt-3 rounded-xl border border-dashed border-line p-3 text-xs">
            <summary className="cursor-pointer font-bold uppercase tracking-wider text-muted">
              {locale === "es" ? "Admin · ver lo que se le pidió a la IA" : "Admin · see what the AI was asked"}
            </summary>
            <p className={`mt-2 ${admin.hasInstructions ? "text-lime" : "text-amber-200"}`}>
              {admin.hasInstructions
                ? locale === "es"
                  ? `✅ El estilo “${admin.templateName}” tiene tus instrucciones de diseño — van primero en el pedido.`
                  : `✅ The “${admin.templateName}” style has your design instructions — they go first in the brief.`
                : locale === "es"
                  ? `⚠ El estilo “${admin.templateName}” NO tiene instrucciones de diseño. Agrégalas en Admin → Estilos para ese estilo.`
                  : `⚠ The “${admin.templateName}” style has NO design instructions. Add them in Admin → Styles for that style.`}
            </p>
            {admin.crest && <p className="mt-1 text-muted">🛡️ {locale === "es" ? "Escudo" : "Crest"}: <span className="font-bold text-white/80">{admin.crest}</span></p>}
            {admin.prompt ? (
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-3 text-[11px] leading-relaxed text-muted [overflow-wrap:anywhere]">{admin.prompt}</pre>
            ) : (
              <p className="mt-2 text-muted">{locale === "es" ? "Este póster se hizo antes de guardar los pedidos." : "This poster was made before briefs were saved."}</p>
            )}
          </details>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">{t("pro_note")}</p>
      </div>

      <div className="space-y-6">
        {url && !busy && <EditDesign id={id} layout={layout} inputs={initial} cost={cost} credits={credits} imageUrl={url} />}
        <details className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold uppercase tracking-wider text-muted">🎲 {locale === "es" ? "Diseño totalmente nuevo" : "Totally new design"}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {locale === "es"
                  ? "Crea un póster diferente desde cero. Para cambiar solo colores, texto o algo puntual usa “Editar este diseño” arriba."
                  : "Makes a different poster from scratch. To change only colors, text or one detail, use “Edit this design” above."}
              </span>
            </span>
            <span className="text-muted transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-4 space-y-4">
          <TextFields layout={layout} value={inputs} onChange={setInputs} />
          <div>
            <label className="label">{t("f_extraPrompt")}</label>
            <textarea
              className="input min-h-24"
              maxLength={1500}
              placeholder={t("f_extraPrompt_ph")}
              value={inputs.extraPrompt}
              onChange={(e) => setInputs({ ...inputs, extraPrompt: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted">{t("pro_regen_hint")}</p>
          {credits >= cost ? (
            <button onClick={regenerate} disabled={busy} className="btn-ghost w-full">
              {busy ? t("processing") : `🎲 ${locale === "es" ? "Hacer un diseño nuevo" : "Make a new design"} · ${t("costs", { n: cost })}`}
            </button>
          ) : (
            <Link href="/pricing" className="btn-ghost w-full">
              {t("get_credits")}
            </Link>
          )}
          </div>
        </details>
        {admin && url && <UpscaleTest bannerId={id} original={url} />}
        {admin && url && <CompareModels bannerId={id} inputs={inputs} />}
        <Link href={`/create?type=${layout.toLowerCase()}${admin ? `&again=${id}` : ""}`} className="btn-primary w-full py-3.5 text-base">
          ＋ {locale === "es" ? "Crear otro" : "Create another one"}
        </Link>
        {admin && (
          <p className="text-center text-xs text-muted">
            {locale === "es" ? "Admin: la foto, el equipo y los textos de este póster se mantienen — solo eliges otro estilo." : "Admin: this poster's photo, team and texts carry over — just pick another style."}
          </p>
        )}
      </div>
    </div>
  );
}

function SampleSetter({ bannerId, admin }: { bannerId: string; admin: { templateId: string; templates: { id: string; name: string }[] } }) {
  const { locale } = useT();
  const es = locale === "es";
  const [tpl, setTpl] = useState(admin.templateId);
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-3 rounded-xl border border-dashed border-line p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
        {es ? "Admin · usar esta imagen en…" : "Admin · use this image on…"}
      </div>
      <div className="flex gap-2">
        <select className="input py-2 text-xs" value={tpl} onChange={(e) => setTpl(e.target.value)}>
          {[1, 2, 3].map((n) => (
            <option key={`hero${n}`} value={`hero:${n}`}>
              🏠 {es ? "Página principal" : "Home page"} — {es ? ["izquierda", "centro", "derecha"][n - 1] : ["left", "center", "right"][n - 1]}
            </option>
          ))}
          {admin.templates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-ghost shrink-0 px-3 py-2 text-xs"
          onClick={async () => {
            setMsg("…");
            const hero = tpl.startsWith("hero:");
            const res = await fetch(hero ? "/api/admin/hero" : `/api/admin/templates/${tpl}/thumb`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(hero ? { bannerId, slot: Number(tpl.slice(5)) } : { bannerId }),
            });
            setMsg(
              res.ok
                ? hero
                  ? es ? "✅ Puesto en la página principal" : "✅ Now on the home page"
                  : es ? "✅ Muestra actualizada" : "✅ Sample updated"
                : es ? "❌ Error" : "❌ Failed",
            );
          }}
        >
          {es ? "Usar" : "Set"}
        </button>
      </div>
      {msg && <p className="mt-1 text-xs">{msg}</p>}
    </div>
  );
}

/** Admin only: make a faithful 2× upscale next to the original, to compare before turning it on for everyone. */
function UpscaleTest({ bannerId, original }: { bannerId: string; original: string }) {
  const { locale } = useT();
  const es = locale === "es";
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ url: string; width?: number; height?: number } | null>(null);
  const [err, setErr] = useState("");
  async function run() {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/banners/${bannerId}/upscale`, { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok && d.url) setRes(d);
    else setErr(d.detail || d.error || "error");
  }
  return (
    <div className="rounded-xl border border-teal/40 bg-teal/5 p-3">
      <button onClick={run} disabled={busy} className="btn-ghost w-full">
        {busy ? (es ? "Escalando… (~20 s)" : "Upscaling… (~20 s)") : `⬆️ ${es ? "Escalar a 4K (prueba admin)" : "4K upscale (admin test)"}`}
      </button>
      <p className="mt-1 text-[11px] text-muted">{es ? "Agranda y afila sin redibujar. Se guarda aparte; el original no cambia." : "Enlarges and sharpens without redrawing. Saved separately; the original stays."}</p>
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
      {res && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
            <a href={original} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original} alt="" className="w-full rounded-lg" />
              {es ? "Original" : "Original"}
            </a>
            <a href={res.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={res.url} alt="" className="w-full rounded-lg" />
              4K {res.width && res.height ? `· ${res.width}×${res.height}` : ""}
            </a>
          </div>
          <p className="text-[11px] text-muted">{es ? "Abre cada una y haz zoom en caras y letras para comparar." : "Open each one and zoom into faces and letters to compare."}</p>
        </div>
      )}
    </div>
  );
}

const MODELS: { key: string; en: string; es: string }[] = [
  { key: "mix3", en: "⭐ All 3 (Nano + FLUX + OpenAI)", es: "⭐ Los 3 (Nano + FLUX + OpenAI)" },
  { key: "seedream-mix", en: "Seedream Mix", es: "Seedream Mix" },
  { key: "mix", en: "Mix: Nano + OpenAI", es: "Mix: Nano + OpenAI" },
  { key: "flux-mix", en: "FLUX Mix: FLUX + OpenAI", es: "Mix FLUX: FLUX + OpenAI" },
  { key: "flux", en: "FLUX.2 Pro only", es: "Solo FLUX.2 Pro" },
  { key: "openai", en: "OpenAI only", es: "Solo OpenAI" },
  { key: "nano-pro", en: "Nano Banana Pro only", es: "Solo Nano Banana Pro" },
];

/** Admin only: make this same poster with every generator, side by side (free; each copy lands in the history). */
function CompareModels({ bannerId, inputs }: { bannerId: string; inputs: BannerInputs }) {
  const { locale } = useT();
  const es = locale === "es";
  type Row = { status: "wait" | "ok" | "fail"; id?: string; url?: string; error?: string; secs?: number };
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState(false);
  async function one(key: string) {
    const t0 = Date.now();
    const set = (r: Row) => setRows((x) => ({ ...x, [key]: r }));
    set({ status: "wait" });
    const res = await fetch(`/api/banners/${bannerId}/background`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs, compareModel: key }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !d.id) return set({ status: "fail", error: d.detail || d.error || "error" });
    const w = await waitForBanner(d.id);
    const secs = Math.round((Date.now() - t0) / 1000);
    set(w.ok ? { status: "ok", id: d.id, url: w.url, secs } : { status: "fail", id: d.id, error: w.detail || w.error, secs });
  }
  async function run() {
    setRunning(true);
    await Promise.all(MODELS.map((m) => one(m.key)));
    setRunning(false);
  }
  return (
    <div className="rounded-xl border border-lime/40 bg-lime/5 p-3">
      <button onClick={run} disabled={running} className="btn-ghost w-full">
        {running ? (es ? "Generando los 7… (1–4 min)" : "Making all 7… (1–4 min)") : `🧪 ${es ? "Comparar los 7 generadores (prueba admin, gratis)" : "Compare all 7 generators (admin test, free)"}`}
      </button>
      <p className="mt-1 text-[11px] text-muted">{es ? "Mismo póster, mismos textos — uno por cada generador de Ajustes. Cada copia queda en tu historial." : "Same poster, same texts — one per generator in Settings. Each copy lands in your history."}</p>
      {Object.keys(rows).length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {MODELS.filter((m) => rows[m.key]).map((m) => {
            const r = rows[m.key];
            return (
              <div key={m.key} className="overflow-hidden rounded-lg border border-line text-[11px]">
                {r.status === "ok" && r.url ? (
                  <a href={`/banner/${r.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt="" className="aspect-[4/5] w-full object-cover" />
                  </a>
                ) : (
                  <div className="grid aspect-[4/5] w-full place-items-center bg-panel-2 p-2 text-center text-muted">
                    {r.status === "wait" ? "⏳" : `❌ ${String(r.error ?? "").slice(0, 120)}`}
                  </div>
                )}
                <div className="px-1.5 py-1 font-bold">
                  {es ? m.es : m.en}
                  {r.secs ? <span className="font-normal text-muted"> · {r.secs}s</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
