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
  proInstructions?: string | null;
  randomize?: boolean;
  uses?: number;
}

const COLOR_KEYS = ["primary", "accent", "dark"] as const;

export function TemplateEditor({ initial, isNew }: { initial: AdminTemplate; isNew?: boolean }) {
  const { t } = useT();
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
          <BannerCanvas layout={tpl.layout} style={tpl.style} inputs={SAMPLE_INPUTS[tpl.layout]} design={DEFAULT_DESIGN} />
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
          <BannerCanvas layout={tpl.layout} style={tpl.style} inputs={SAMPLE_INPUTS[tpl.layout]} design={DEFAULT_DESIGN} />
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
            kind="logo"
            label="Pro AI style reference (optional)"
            hint="An example design the Pro AI should match in look and feel. Only use designs you own or have permission to use for AI."
            value={tpl.styleRefUrl ?? null}
            onChange={(url) => set("styleRefUrl", url)}
          />
        </div>
        <div>
          <label className="label">Design instructions for the AI (Pro AI)</label>
          <textarea
            className="input min-h-40 text-sm"
            maxLength={3000}
            value={tpl.proInstructions ?? ""}
            onChange={(e) => set("proInstructions", e.target.value)}
            placeholder={"Tell the AI exactly what this flyer should look like. Examples:\n• Put the team crest huge in the centre with angel wings behind it.\n• Title CHAMPIONS at the top in cracked gold stone letters, stacked 3 times.\n• Player names in a gold bar under the title.\n• Trophy on the right side, slightly cut off by the frame.\n• Warm sunset light, marble floor, confetti."}
          />
          <p className="mt-1 text-xs text-muted">These override the built-in layout instructions. Leave empty to use the defaults.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={tpl.randomize !== false} onChange={(e) => set("randomize", e.target.checked)} />
          <span>
            <b>Unique look on every poster</b>
            <span className="block text-xs text-muted">
              Random palette, background concept, layout and lighting each time. Turn off for a consistent look (e.g. an official league style).
            </span>
          </span>
        </label>
        <div>
          <label className="label">AI background / mood description (also used by Quick mode)</label>
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
