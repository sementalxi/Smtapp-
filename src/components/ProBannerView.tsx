"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";
import type { BannerInputs, LayoutKind } from "@/lib/templates";
import { TextFields } from "./TextFields";
import { DownloadSizes } from "./DownloadSizes";

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
  admin?: { templateId: string; templates: { id: string; name: string }[] };
}) {
  const { t } = useT();
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
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.finalUrl) {
      setUrl(data.finalUrl);
      router.refresh();
    } else {
      const known: DictKey[] = ["err_credits", "err_blocked"];
      setError(t(known.includes(data.error) ? data.error : "err_generic") + (data.detail ? ` — ${data.detail}` : ""));
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="card relative overflow-hidden">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className={`block aspect-[4/5] w-full object-cover ${busy ? "opacity-40" : ""}`} />
          ) : (
            <div className="aspect-[4/5] bg-panel-2" />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm font-semibold text-lime">
              {t("pro_wait")}
            </div>
          )}
          <span className="chip absolute top-3 left-3 border-lime bg-ink/70 text-lime">✨ {t("pro_badge")}</span>
        </div>
        {url && !busy && (
          <div className="mt-3">
            <DownloadSizes src={url} baseName={title} />
            {layout === "PLAYER" && (
              <Link href={`/create?match=${id}`} className="btn-primary mt-2 w-full">
                👥 {t("team_set_next")}
              </Link>
            )}
          </div>
        )}
        {admin && url && <SampleSetter bannerId={id} admin={admin} />}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-xs text-muted">{t("pro_note")}</p>
      </div>

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{t("text")}</h2>
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
              {busy ? t("processing") : `✨ ${t("pro_regen")} · ${t("costs", { n: cost })}`}
            </button>
          ) : (
            <Link href="/pricing" className="btn-ghost w-full">
              {t("get_credits")}
            </Link>
          )}
        </section>
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
