import type { CSSProperties } from "react";

/** The admin's banner message at the top of every page — with its colour and text effect. */
export function NoticeBar({ text, color = "#ff2e88", effect = "none" }: { text: string; color?: string; effect?: string }) {
  if (!text?.trim()) return null;
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ff2e88";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dark = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6; // light background → dark text
  const fg = dark ? "#120a10" : "#ffffff";
  const base = "px-4 py-2 text-center text-sm font-bold";
  const style = { background: hex, color: fg } as const;
  if (effect === "marquee") {
    const item = <span className="mx-8 inline-block">{text}</span>;
    return (
      <div className={`overflow-hidden whitespace-nowrap ${base}`} style={style} aria-label={text}>
        <div className="kixo-marquee inline-flex w-max">
          {Array.from({ length: 6 }, (_, i) => <span key={i}>{item}</span>)}
        </div>
      </div>
    );
  }
  const fx = effect === "glow" ? "kixo-text-glow" : effect === "shine" ? "kixo-text-shine" : effect === "blink" ? "kixo-text-blink" : "";
  return (
    <div className={base} style={style}>
      <span className={fx} style={effect === "glow" ? ({ ["--glow" as string]: fg } as CSSProperties) : undefined}>{text}</span>
    </div>
  );
}
