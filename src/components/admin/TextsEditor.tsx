"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

type Lang = "en" | "es";
type Texts = Record<Lang, Record<string, string>>;

// Section names by key prefix (the part before the first "_").
const SECTIONS: Record<string, [string, string]> = {
  nav: ["Top menu", "Menú superior"],
  hero: ["Home page — top", "Página principal — arriba"],
  how: ["Home page — how it works", "Página principal — cómo funciona"],
  styles: ["Home page — styles", "Página principal — estilos"],
  free: ["Home page — free credits", "Página principal — créditos gratis"],
  pricing: ["Pricing", "Precios"],
  plans: ["Pricing — plans", "Precios — planes"],
  plan: ["Pricing — plans", "Precios — planes"],
  packs: ["Pricing — credit packs", "Precios — paquetes"],
  pack: ["Pricing — credit packs", "Precios — paquetes"],
  dash: ["Home (logged in)", "Inicio (con sesión)"],
  create: ["Create page", "Página de crear"],
  pro: ["Pro AI poster", "Póster IA Pro"],
  f: ["Form fields", "Campos del formulario"],
  err: ["Error messages", "Mensajes de error"],
  admin: ["Admin panel", "Panel admin"],
  stat: ["Admin panel — stats", "Panel admin — estadísticas"],
  login: ["Log in / sign up", "Entrar / registrarse"],
  register: ["Log in / sign up", "Entrar / registrarse"],
  auth: ["Log in / sign up", "Entrar / registrarse"],
  payment: ["Billing", "Facturación"],
  billing: ["Billing", "Facturación"],
};

const sectionOf = (key: string, es: boolean) => {
  const s = SECTIONS[key.split("_")[0]];
  return s ? s[es ? 1 : 0] : es ? "Otros textos" : "Other texts";
};

/** Admin: edit any text in the site's dictionary, in English and Spanish. */
export function TextsEditor({ defaults, initial }: { defaults: Texts; initial: Texts }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [vals, setVals] = useState<Texts>({ en: { ...initial.en }, es: { ...initial.es } });
  const [q, setQ] = useState("");
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);

  const keys = Object.keys(defaults.en);
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = new Map<string, string[]>();
    for (const k of keys) {
      const edited = !!(vals.en[k] || vals.es[k]);
      if (onlyEdited && !edited) continue;
      if (
        term &&
        ![k, defaults.en[k], defaults.es[k], vals.en[k] ?? "", vals.es[k] ?? ""].some((x) => x.toLowerCase().includes(term))
      )
        continue;
      const sec = sectionOf(k, es);
      out.set(sec, [...(out.get(sec) ?? []), k]);
    }
    return [...out.entries()];
  }, [keys, q, onlyEdited, vals, defaults, es]);

  const set = (lang: Lang, k: string, v: string) => {
    setVals((x) => ({ ...x, [lang]: { ...x[lang], [k]: v } }));
    setDirty(true);
    setMsg("");
  };
  const reset = (k: string) => {
    setVals((x) => {
      const en = { ...x.en };
      const esv = { ...x.es };
      delete en[k];
      delete esv[k];
      return { en, es: esv };
    });
    setDirty(true);
  };

  async function save() {
    setBusy(true);
    const res = await fetch("/api/admin/texts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(vals) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setDirty(false);
      setMsg(es ? `✅ Guardado (${data.saved} textos personalizados)` : `✅ Saved (${data.saved} custom texts)`);
      router.refresh();
    } else setMsg(es ? "❌ No se pudo guardar" : "❌ Couldn't save");
  }

  const editedCount = new Set([...Object.keys(vals.en).filter((k) => vals.en[k]), ...Object.keys(vals.es).filter((k) => vals.es[k])]).size;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {es
          ? "Cambia cualquier texto del sitio en inglés y español. Deja un campo vacío para usar el texto original (se muestra gris). Los textos con {n} o {name} se rellenan solos — déjalos en tu versión."
          : "Change any text on the site, in English and Spanish. Leave a box empty to use the original text (shown in grey). Texts with {n} or {name} get filled in automatically — keep them in your version."}
      </p>

      <div className="sticky top-14 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink/95 p-2 backdrop-blur sm:top-16">
        <input className="input min-w-0 flex-1 py-2" placeholder={es ? "🔍 Buscar texto… (ej. “banners”)" : "🔍 Search text… (e.g. “banners”)"} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setOnlyEdited(!onlyEdited)} className={`chip ${onlyEdited ? "border-lime bg-lime text-ink" : "text-muted"}`}>
          {es ? "Editados" : "Edited"} ({editedCount})
        </button>
        <button type="button" className="btn-primary px-4 py-2" disabled={busy || !dirty} onClick={save}>
          {busy ? "…" : es ? "Guardar" : "Save"}
        </button>
        {msg && <span className="w-full text-xs">{msg}</span>}
      </div>

      {groups.length === 0 && <div className="card p-8 text-center text-sm text-muted">{es ? "Nada coincide." : "Nothing matches."}</div>}

      {groups.map(([section, ks]) => (
        <details key={section} className="card overflow-hidden" open={!!q.trim() || onlyEdited}>
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-bold">
            {section}
            <span className="text-xs font-normal text-muted">{ks.length}</span>
          </summary>
          <div className="divide-y divide-line border-t border-line">
            {ks.map((k) => {
              const edited = !!(vals.en[k] || vals.es[k]);
              const long = Math.max(defaults.en[k].length, defaults.es[k].length) > 60;
              return (
                <div key={k} className="space-y-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-[11px] text-muted">{k}</code>
                    {edited && (
                      <button type="button" className="text-[11px] text-lime hover:underline" onClick={() => reset(k)}>
                        ↺ {es ? "Restaurar original" : "Restore original"}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["en", "es"] as const).map((lang) => (
                      <label key={lang} className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted">{lang === "en" ? "English" : "Español"}</span>
                        {long ? (
                          <textarea className="input min-h-20 py-2 text-sm" placeholder={defaults[lang][k]} value={vals[lang][k] ?? ""} onChange={(e) => set(lang, k, e.target.value)} />
                        ) : (
                          <input className="input py-2 text-sm" placeholder={defaults[lang][k]} value={vals[lang][k] ?? ""} onChange={(e) => set(lang, k, e.target.value)} />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
