"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { DEFAULT_DESIGN, LayoutKind, TemplateStyle } from "@/lib/templates";
import { SAMPLE_INPUTS } from "@/lib/samples";
import { BannerCanvas } from "../BannerCanvas";
import { ImageDrop } from "../ImageDrop";

export interface AdminTemplate {
  id?: string;
  slug: string;
  name: string;
  nameEs: string;
  layout: LayoutKind;
  prompt: string;
  style: TemplateStyle;
  cost: number;
  active: boolean;
  sort: number;
  styleRefUrl?: string | null;
  thumbUrl?: string | null;
  proInstructions?: string | null;
  randomize?: boolean;
  uses?: number;
}

const COLOR_KEYS = ["primary", "accent", "dark"] as const;

export function TemplateEditor({ initial, isNew }: { initial: AdminTemplate; isNew?: boolean }) {
  const { t, locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [tpl, setTpl] = useState(initial);
  const [styleText, setStyleText] = useState(JSON.stringify(initial.style, null, 2));
  const [open, setOpen] = useState(!!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof AdminTemplate>(k: K, v: AdminTemplate[K]) => setTpl((x) => ({ ...x, [k]: v }));
  const setStyle = (s: TemplateStyle) => {
    set("style", s);
    setStyleText(JSON.stringify(s, null, 2));
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    let style: TemplateStyle;
    try {
      style = JSON.parse(styleText);
    } catch {
      setMsg({ ok: false, text: "Style JSON is invalid" });
      setBusy(false);
      return;
    }
    const body = { ...tpl, style };
    delete body.id;
    delete body.uses;
    const res = await fetch(isNew ? "/api/admin/templates" : `/api/admin/templates/${tpl.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: t("saved_ok") });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.details?.join(", ") ?? data.error ?? t("err_generic") });
    }
  }

  async function remove() {
    if (!tpl.id || !confirm(t("confirm_delete"))) return;
    setBusy(true);
    await fetch(`/api/admin/templates/${tpl.id}`, { method: "DELETE" });
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="card flex w-full items-center gap-4 p-3 text-left hover:border-muted">
        <div className="w-16 shrink-0 overflow-hidden rounded-md">
          {tpl.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tpl.thumbUrl} alt="" className="block aspect-[4/5] w-full object-cover" />
          ) : (
            <BannerCanvas layout={tpl.layout} style={tpl.style} inputs={SAMPLE_INPUTS[tpl.layout]} design={DEFAULT_DESIGN} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {tpl.name} <span className="text-muted">/ {tpl.nameEs}</span>
          </div>
          <div className="text-xs text-muted">
            {tpl.slug} · {tpl.layout} · {t("cost")}: {tpl.cost} · {tpl.uses ?? 0} uses
          </div>
        </div>
        <span className={`chip ${tpl.active ? "border-lime/50 text-lime" : "text-muted"}`}>
          {tpl.active ? t("active") : t("inactive")}
        </span>
      </button>
    );
  }

  return (
    <div className="card grid gap-6 p-5 lg:grid-cols-[260px_1fr]">
      <div>
        <div className="overflow-hidden rounded-lg">
          {tpl.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tpl.thumbUrl} alt="" className="block aspect-[4/5] w-full object-cover" />
          ) : (
            <BannerCanvas layout={tpl.layout} style={tpl.style} inputs={SAMPLE_INPUTS[tpl.layout]} design={DEFAULT_DESIGN} />
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {COLOR_KEYS.map((k) => (
            <label key={k} className="text-center text-[10px] uppercase text-muted">
              <input
                type="color"
                value={tpl.style[k].slice(0, 7)}
                onChange={(e) => setStyle({ ...tpl.style, [k]: e.target.value })}
                className="h-9 w-full cursor-pointer rounded border border-line bg-transparent"
              />
              {k}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">{t("name_en")}</label>
            <input className="input" value={tpl.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("name_es")}</label>
            <input className="input" value={tpl.nameEs} onChange={(e) => set("nameEs", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("slug")}</label>
            <input className="input" value={tpl.slug} onChange={(e) => set("slug", e.target.value)} />
          </div>
          <div>
            <label className="label">{t("layout")}</label>
            <select className="input" value={tpl.layout} onChange={(e) => set("layout", e.target.value as LayoutKind)}>
              <option value="PLAYER">PLAYER</option>
              <option value="CHAMPIONS">CHAMPIONS</option>
              <option value="EVENT">EVENT</option>
              <option value="MATCHDAY">MATCHDAY</option>
              <option value="LINEUP">LINEUP</option>
              <option value="RESULT">RESULT</option>
            </select>
          </div>
          <div>
            <label className="label">{t("cost")}</label>
            <input type="number" min={0} className="input" value={tpl.cost} onChange={(e) => set("cost", Number(e.target.value))} />
          </div>
          <div>
            <label className="label">{t("order")}</label>
            <input type="number" min={0} className="input" value={tpl.sort} onChange={(e) => set("sort", Number(e.target.value))} />
          </div>
        </div>
        <div>
          <ImageDrop
            noSearch
            kind="photo"
            label={es ? "Imagen de muestra (la que ven los usuarios)" : "Sample image (what users see)"}
            hint={es ? "Reemplaza la vista previa de este estilo en la página principal y en el creador. Mejor en vertical 4:5." : "Replaces this style's preview on the home page and in the creator. Best as a vertical 4:5 image."}
            value={tpl.thumbUrl ?? null}
            onChange={(url) => set("thumbUrl", url)}
          />
        </div>
        <div>
          <ImageDrop
            noSearch
            kind="logo"
            label={es ? "Referencia de estilo para IA Pro (opcional)" : "Pro AI style reference (optional)"}
            hint={es ? "Un diseño de ejemplo que la IA Pro debe imitar en estilo. Usa solo diseños tuyos o con permiso para IA." : "An example design the Pro AI should match in look and feel. Only use designs you own or have permission to use for AI."}
            value={tpl.styleRefUrl ?? null}
            onChange={(url) => set("styleRefUrl", url)}
          />
        </div>
        <div>
          <label className="label">{es ? "Instrucciones de diseño para la IA (IA Pro)" : "Design instructions for the AI (Pro AI)"}</label>
          <textarea
            className="input min-h-40 text-sm"
            maxLength={20000}
            value={tpl.proInstructions ?? ""}
            onChange={(e) => set("proInstructions", e.target.value)}
            placeholder={es ? "Dile a la IA exactamente cómo debe verse este flyer. Ejemplos:\n• El escudo del equipo enorme en el centro con alas de ángel detrás.\n• El título CAMPEONES arriba en letras de piedra dorada agrietada, repetido 3 veces.\n• Los nombres de los jugadores en una barra dorada bajo el título.\n• El trofeo a la derecha, un poco cortado por el marco.\n• Luz cálida de atardecer, piso de mármol, confeti." : "Tell the AI exactly what this flyer should look like. Examples:\n• Put the team crest huge in the centre with angel wings behind it.\n• Title CHAMPIONS at the top in cracked gold stone letters, stacked 3 times.\n• Player names in a gold bar under the title.\n• Trophy on the right side, slightly cut off by the frame.\n• Warm sunset light, marble floor, confetti."}
          />
          <p className="mt-1 text-xs text-muted">{es ? "Estas reemplazan las instrucciones de diseño por defecto. Déjalo vacío para usar las de siempre." : "These override the built-in layout instructions. Leave empty to use the defaults."}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={tpl.randomize !== false} onChange={(e) => set("randomize", e.target.checked)} />
          <span>
            <b>{es ? "Diseño único en cada póster" : "Unique look on every poster"}</b>
            <span className="block text-xs text-muted">
              {tpl.proInstructions?.trim()
                ? es
                  ? "Con tus instrucciones: solo cambian detalles pequeños en cada póster — tu diseño y tus colores se respetan. Apágalo para que salga casi igual cada vez."
                  : "With your instructions: only small details change per poster — your layout and colours are kept. Turn off to get nearly the same result every time."
                : es
                  ? "Paleta, fondo, composición y luz aleatorios cada vez. Apágalo para un estilo constante (ej. el estilo oficial de una liga)."
                  : "Random palette, background concept, layout and lighting each time. Turn off for a consistent look (e.g. an official league style)."}
            </span>
          </span>
        </label>
        <div>
          <label className="label">{es ? "Descripción del fondo / ambiente para la IA (también la usa el modo Rápido)" : "AI background / mood description (also used by Quick mode)"}</label>
          <textarea className="input min-h-24" value={tpl.prompt} onChange={(e) => set("prompt", e.target.value)} />
        </div>
        <details>
          <summary className="label cursor-pointer">{t("style_json")}</summary>
          <textarea
            className="input min-h-64 font-mono text-xs"
            value={styleText}
            onChange={(e) => {
              setStyleText(e.target.value);
              try {
                set("style", JSON.parse(e.target.value));
              } catch {
                /* keep typing */
              }
            }}
          />
        </details>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tpl.active} onChange={(e) => set("active", e.target.checked)} />
          {t("active")}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={busy} onClick={save} className="btn-primary">{isNew ? t("create") : t("save")}</button>
          {!isNew && (
            <>
              <button onClick={() => setOpen(false)} className="btn-ghost">✕</button>
              <button disabled={busy} onClick={remove} className="btn-danger ml-auto">{t("delete")}</button>
            </>
          )}
          {msg && <span className={`text-sm ${msg.ok ? "text-lime" : "text-danger"}`}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
}
