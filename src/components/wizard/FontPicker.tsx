"use client";

import { FONT_STYLES } from "@/lib/pro-options";

const FAMILY: Record<string, string> = {
  anton: "var(--nf-anton), Impact, sans-serif",
  bebas: "var(--nf-bebas), sans-serif",
  gothic: "var(--nf-gothic), serif",
  brush: "var(--nf-brush), cursive",
  sans: "inherit",
};

/** Pick a lettering style for the AI (or let it choose). */
export function FontPicker({ label, value, onChange, sample, es }: { label: string; value: string; onChange: (v: string) => void; sample: string; es: boolean }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex w-28 shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition ${!value ? "border-lime bg-lime/10" : "border-line bg-panel-2"}`}
        >
          <span className="text-xl">🤖</span>
          <span className="mt-1 text-[11px] font-bold">{es ? "Auto (la IA elige)" : "Auto (AI picks)"}</span>
        </button>
        {FONT_STYLES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`flex w-28 shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-2 py-3 text-center transition ${value === f.id ? "border-lime bg-lime/10" : "border-line bg-panel-2"}`}
          >
            <span className={`block max-w-full truncate text-xl leading-tight text-white ${f.previewClass}`} style={{ fontFamily: FAMILY[f.preview] }}>
              {sample}
            </span>
            <span className="mt-1 text-[11px] font-bold text-muted">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
