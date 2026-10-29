"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";
import type { BannerInputs, DesignState, LayoutKind, TemplateStyle } from "@/lib/templates";
import { BannerCanvas, type BannerCanvasHandle } from "./BannerCanvas";
import { TextFields } from "./TextFields";
import { DownloadSizes } from "./DownloadSizes";

interface Props {
  banner: {
    id: string;
    title: string;
    inputs: BannerInputs;
    design: DesignState;
    backgroundUrl: string | null;
    cutoutUrl: string | null;
    logoUrl: string | null;
  };
  layout: LayoutKind;
  style: TemplateStyle;
  cost: number;
  credits: number;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </span>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-lime" />
    </label>
  );
}

export function BannerEditor({ banner, layout, style, cost, credits }: Props) {
  const { t } = useT();
  const router = useRouter();
  const canvas = useRef<BannerCanvasHandle>(null);
  const [inputs, setInputs] = useState(banner.inputs);
  const [design, setDesign] = useState(banner.design);
  const [bg, setBg] = useState(banner.backgroundUrl);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [busy, setBusy] = useState<"" | "bg" | "dl">("");
  const [error, setError] = useState("");
  const [extra, setExtra] = useState("");
  const first = useRef(true);

  const set = <K extends keyof DesignState>(k: K, v: DesignState[K]) => setDesign((d) => ({ ...d, [k]: v }));

  // Autosave (debounced) whenever text or adjustments change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("saving");
    const id = setTimeout(async () => {
      const res = await fetch(`/api/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, design }),
      });
      setSaveState(res.ok ? "saved" : "idle");
    }, 800);
    return () => clearTimeout(id);
  }, [inputs, design, banner.id]);

  async function download() {
    setBusy("dl");
    const blob = await canvas.current?.toBlob();
    if (blob) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(inputs.name || inputs.team || "banner").replace(/[^\w-]+/g, "_")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      // Gallery copy as JPEG (smaller upload); the user's download stays full-quality PNG.
      const jpg = await canvas.current?.toBlob("image/jpeg");
      if (jpg) {
        const fd = new FormData();
        fd.append("file", jpg, "banner.jpg");
        fetch(`/api/banners/${banner.id}/final`, { method: "POST", body: fd }).catch(() => {});
      }
    } else {
      setError(t("err_generic"));
    }
    setBusy("");
  }

  async function newBackground() {
    setBusy("bg");
    setError("");
    const res = await fetch(`/api/banners/${banner.id}/background`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraPrompt: extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBg(data.backgroundUrl);
      router.refresh();
    } else {
      const known: DictKey[] = ["err_credits", "err_blocked"];
      setError(t(known.includes(data.error) ? data.error : "err_generic"));
    }
    setBusy("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <BannerCanvas
            ref={canvas}
            layout={layout}
            style={style}
            inputs={inputs}
            design={design}
            backgroundUrl={bg}
            cutoutUrl={banner.cutoutUrl}
            logoUrl={banner.logoUrl}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={download} disabled={!!busy} className="btn-primary flex-1 py-3">
            ⬇ {t("download")}
          </button>
          <span className="w-20 text-right text-xs text-muted">
            {saveState === "saving" ? "…" : saveState === "saved" ? `✓ ${t("saved")}` : ""}
          </span>
        </div>
        <div className="mt-3">
          <DownloadSizes
            primary=""
            baseName={inputs.name || inputs.team || "banner"}
            src={async () => {
              const b = await canvas.current?.toBlob();
              return b ? URL.createObjectURL(b) : null;
            }}
          />
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{t("text")}</h2>
          <TextFields layout={layout} value={inputs} onChange={setInputs} />
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{t("adj_player")}</h2>
          <Slider label={t("adj_x")} value={design.playerX} min={-0.5} max={0.5} onChange={(v) => set("playerX", v)} />
          <Slider label={t("adj_y")} value={design.playerY} min={-0.5} max={0.5} onChange={(v) => set("playerY", v)} />
          <Slider label={t("adj_scale")} value={design.playerScale} min={0.5} max={1.8} onChange={(v) => set("playerScale", v)} />
          {layout === "PLAYER" && style.ghost && (
            <>
              <Toggle label={t("adj_ghost")} value={design.ghost} onChange={(v) => set("ghost", v)} />
              <Slider label={t("adj_ghost_op")} value={design.ghostOpacity} min={0} max={1} onChange={(v) => set("ghostOpacity", v)} />
            </>
          )}
          <Slider label={t("adj_name")} value={design.nameScale} min={0.6} max={1.4} onChange={(v) => set("nameScale", v)} />
          <Slider label={t("adj_logo")} value={design.logoScale} min={0.5} max={1.6} onChange={(v) => set("logoScale", v)} />
          <Slider label={t("adj_overlay")} value={design.overlay} min={0} max={1} onChange={(v) => set("overlay", v)} />
          <Toggle label={t("adj_particles")} value={design.particles} onChange={(v) => set("particles", v)} />
          <button type="button" className="btn-ghost w-full" onClick={() => set("seed", Math.floor(Math.random() * 100000))}>
            🎲 {t("adj_shuffle")}
          </button>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{t("regenerate_bg")}</h2>
          <input
            className="input"
            maxLength={200}
            placeholder={t("f_extraPrompt_ph")}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          {credits >= cost ? (
            <button onClick={newBackground} disabled={!!busy} className="btn-ghost w-full">
              {busy === "bg" ? t("processing") : `⚡ ${t("regenerate_bg")} · ${t("costs", { n: cost })}`}
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
