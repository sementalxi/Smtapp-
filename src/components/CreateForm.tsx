"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";
import { SAMPLE_INPUTS, type ClientTemplate } from "@/lib/samples";
import { BannerInputs, DEFAULT_DESIGN, EMPTY_INPUTS } from "@/lib/templates";
import { TemplateThumb } from "./TemplateThumb";
import { ImageDrop } from "./ImageDrop";
import { TextFields } from "./TextFields";
import { BannerCanvas } from "./BannerCanvas";

export function CreateForm({
  templates,
  credits,
  initialSlug,
  aiEnabled,
  proEnabled,
  proCost,
}: {
  templates: ClientTemplate[];
  credits: number;
  initialSlug?: string;
  aiEnabled: boolean;
  proEnabled: boolean;
  proCost: number;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [tplId, setTplId] = useState(templates.find((x) => x.slug === initialSlug)?.id ?? templates[0]?.id);
  const tpl = templates.find((x) => x.id === tplId) ?? templates[0];
  const [inputs, setInputs] = useState<BannerInputs>(EMPTY_INPUTS);
  const [photo, setPhoto] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [isCutout, setIsCutout] = useState(false);
  const [mode, setMode] = useState<"QUICK" | "PRO">(proEnabled ? "PRO" : "QUICK");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const previewInputs = useMemo(() => {
    // Show the sample text until the user types something.
    const s = SAMPLE_INPUTS[tpl.layout];
    const out = { ...inputs };
    (Object.keys(out) as (keyof BannerInputs)[]).forEach((k) => {
      const v = out[k];
      if ((Array.isArray(v) && v.length === 0) || v === "") (out as Record<string, unknown>)[k] = s[k];
    });
    return out;
  }, [inputs, tpl.layout]);

  const needsPhoto = tpl.layout === "PLAYER";
  const pro = mode === "PRO";
  const cost = pro ? proCost : aiEnabled ? tpl.cost : 0;
  const canAfford = credits >= cost;

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: tpl.id, inputs, photoUrl: photo, logoUrl: logo, isCutout, mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      router.push(`/banner/${data.id}`);
      router.refresh();
      return;
    }
    const known: DictKey[] = ["err_credits", "err_blocked"];
    setError(t(known.includes(data.error) ? data.error : "err_generic"));
    setBusy(false);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">{t("step_style")}</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {templates.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setTplId(x.id)}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  x.id === tpl.id ? "border-lime" : "border-transparent opacity-80 hover:opacity-100"
                }`}
              >
                <TemplateThumb template={x} />
                <div className="bg-panel px-2 py-1.5">
                  <div className="truncate text-xs font-bold">{locale === "es" ? x.nameEs : x.name}</div>
                  <div className="text-[10px] text-muted">{t(`layout_${x.layout}` as DictKey)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">{t("mode_title")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PRO", "QUICK"] as const).map((m) => {
              const disabled = m === "PRO" && !proEnabled;
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMode(m)}
                  className={`card p-4 text-left transition disabled:opacity-50 ${active ? "border-lime" : "hover:border-muted"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {m === "PRO" ? "✨ " + t("mode_pro") : "⚡ " + t("mode_quick")}
                    </span>
                    <span className="chip text-lime">
                      {m === "PRO" ? proCost : aiEnabled ? tpl.cost : 0} {t("credits")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {disabled ? t("pro_off") : t(m === "PRO" ? "mode_pro_d" : "mode_quick_d")}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{t("step_details")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <ImageDrop
                kind="photo"
                label={t("photo")}
                hint={needsPhoto ? t("photo_hint") : t("photo_optional")}
                value={photo}
                onChange={setPhoto}
              />
              {photo && !pro && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={isCutout} onChange={(e) => setIsCutout(e.target.checked)} />
                  {t("already_cutout")}
                </label>
              )}
            </div>
            <ImageDrop kind="logo" label={t("logo")} value={logo} onChange={setLogo} />
          </div>

          <TextFields layout={tpl.layout} value={inputs} onChange={setInputs} />

          <div>
            <label className="label">{t("f_extraPrompt")}</label>
            <input
              className="input"
              maxLength={200}
              placeholder={t("f_extraPrompt_ph")}
              value={inputs.extraPrompt}
              onChange={(e) => setInputs({ ...inputs, extraPrompt: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted">{t("rights_note")}</p>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <BannerCanvas
            layout={tpl.layout}
            style={tpl.style}
            inputs={previewInputs}
            design={DEFAULT_DESIGN}
            cutoutUrl={photo}
            logoUrl={logo}
          />
          <div className="space-y-3 p-4">
            {error && <p className="text-sm text-danger">{error}</p>}
            {busy && <p className="text-sm text-lime">{t(pro ? "pro_wait" : "generating_wait")}</p>}
            {pro && !busy && <p className="text-xs text-muted">{t("pro_note")}</p>}
            {canAfford ? (
              <button
                onClick={submit}
                disabled={busy || (needsPhoto && !photo)}
                className="btn-primary w-full py-3 text-base"
              >
                {busy ? "…" : `${pro ? "✨" : "⚡"} ${t("generate")}`}
              </button>
            ) : (
              <Link href="/pricing" className="btn-primary w-full py-3">
                {t("get_credits")}
              </Link>
            )}
            <p className="text-center text-xs text-muted">
              {t("costs", { n: cost })} · {t("balance")}: {credits}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
