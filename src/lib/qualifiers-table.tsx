// Exact regions table for qualifiers posters: KIXO draws the panel itself — real flags for the flag emojis
// people type, exact names and numbers, the total bar — and places it on the AI-made background, which
// leaves that area empty (see qualifiers-box.ts). Fonts come from Google Fonts at run time, like the standings table.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { siteUrl } from "./email-template";
import { googleFont } from "./standings-table";
import { qualTableBox } from "./qualifiers-box";
import type { BannerInputs } from "./templates";

export type QualIcon = { kind: "flag"; cc: string } | { kind: "globe"; which: "africa" | "americas" | "asia" | "plain" } | null;
export type QualRow = { icon: QualIcon; name: string; count: string };
export type QualTableSpec = {
  rows: QualRow[];
  header: { region: string; unit: string };
  total: string;
  accent: string;
  format: "post" | "story" | "banner" | "square";
};

const RI_A = 0x1f1e6; // 🇦
const EMOJI_RE = /^(?:\p{Regional_Indicator}{2}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}](?:️)?(?:[\u{E0020}-\u{E007F}]+)?)/u;

/** A flag emoji → the flag file's code ("🇪🇺" → "eu", "🏴󠁧󠁢󠁥󠁮󠁧󠁿" → "gb-eng"); other emojis → a globe. */
export function iconFor(emoji: string): QualIcon {
  const cps = [...emoji].map((c) => c.codePointAt(0)!);
  if (cps.length === 2 && cps.every((c) => c >= RI_A && c <= RI_A + 25)) return { kind: "flag", cc: cps.map((c) => String.fromCharCode(97 + (c - RI_A))).join("") };
  if (emoji.startsWith("🏴") && cps.length > 2) {
    const tags = cps.filter((c) => c >= 0xe0061 && c <= 0xe007a).map((c) => String.fromCharCode(c - 0xe0000));
    const t = tags.join(""); // "gbeng" / "gbsct" / "gbwls"
    if (t.startsWith("gb") && t.length === 5) return { kind: "flag", cc: `gb-${t.slice(2)}` };
  }
  if (emoji.startsWith("🌍")) return { kind: "globe", which: "africa" };
  if (emoji.startsWith("🌎")) return { kind: "globe", which: "americas" };
  if (emoji.startsWith("🌏")) return { kind: "globe", which: "asia" };
  return { kind: "globe", which: "plain" };
}

/** "🇪🇺 Europe · 24" → row. Exported for the prompt builder too. */
export function parseQualRow(line: string): QualRow | null {
  let s = line.trim();
  if (!s) return null;
  let icon: QualIcon = null;
  const m = EMOJI_RE.exec(s);
  if (m) {
    icon = iconFor(m[0]);
    s = s.slice(m[0].length).trim();
  }
  const parts = s.split(/\s*[·|:\-–—]\s*|\s{2,}/).map((x) => x.trim()).filter(Boolean);
  let name = s, count = "";
  if (parts.length >= 2 && /^[\d.,]+\+?$/.test(parts[parts.length - 1])) {
    count = parts[parts.length - 1];
    name = parts.slice(0, -1).join(" ");
  } else {
    const t = s.match(/^(.*?)[\s·:]+([\d.,]+\+?)$/);
    if (t) {
      name = t[1].trim();
      count = t[2];
    }
  }
  return name ? { icon, name, count } : null;
}

/** The total bar text: the user's own, or the numbers added up. */
export function qualTotalText(i: BannerInputs, rows: QualRow[]): string {
  if (i.total.trim()) return i.total.trim();
  const unit = (i.unit || "Managers").trim();
  const nums = rows.map((r) => Number(String(r.count).replace(/[^\d.]/g, "")));
  if (!rows.length || !rows.every((r) => r.count) || !nums.every((n) => Number.isFinite(n))) return "";
  const sum = nums.reduce((a, b) => a + b, 0);
  return sum > 0 ? `TOTAL — ${Number.isInteger(sum) ? sum : sum.toFixed(1)} ${unit.toUpperCase()}` : "";
}

export function qualTableSpecFrom(i: BannerInputs, accent: string, format: "post" | "story" | "banner" | "square"): QualTableSpec | null {
  const rows = i.regions.map(parseQualRow).filter((r): r is QualRow => !!r).slice(0, 12);
  if (!rows.length) return null;
  const es = i.language === "Español";
  return { rows, header: { region: es ? "REGIÓN" : "REGION", unit: (i.unit || "Managers").trim().toUpperCase() }, total: qualTotalText(i, rows), accent, format };
}

const hex = (c: string) => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { r: 255, g: 200, b: 60 };
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};
const rgba = (c: string, a: number) => {
  const { r, g, b } = hex(c);
  return `rgba(${r},${g},${b},${a})`;
};
const luma = (c: string) => {
  const { r, g, b } = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const flagCache = new Map<string, Buffer | null>();
/** A flag as PNG bytes (from /public/flags, copied from flag-icons at build time); null when unknown. */
async function flagPng(cc: string, w: number): Promise<Buffer | null> {
  const key = `${cc}@${w}`;
  if (flagCache.has(key)) return flagCache.get(key)!;
  let out: Buffer | null = null;
  try {
    if (/^[a-z]{2}(-[a-z]{3})?$/.test(cc)) {
      const res = await fetch(`${siteUrl()}/flags/${cc}.svg`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const svg = Buffer.from(await res.arrayBuffer());
        out = await sharp(svg, { density: 300 }).resize(w, Math.round((w * 3) / 4), { fit: "fill" }).png().toBuffer();
      }
    }
  } catch {
    out = null;
  }
  flagCache.set(key, out);
  return out;
}

/** A simple globe icon in the accent colour (meridians + parallels, a continent-ish blob for the hemisphere). */
async function globePng(which: "africa" | "americas" | "asia" | "plain", px: number, accent: string): Promise<Buffer> {
  const { r, g, b } = hex(accent);
  const col = `rgb(${r},${g},${b})`;
  const blob =
    which === "americas"
      ? `<path d="M34 22c8-4 16-2 18 6 1 6-6 10-9 16-3 7-1 13-8 15-5 1-8-6-10-12-2-8 1-21 9-25z" fill="${col}" opacity="0.9"/>`
      : which === "asia"
        ? `<path d="M40 24c10-4 24-2 28 8 3 8-4 14-12 16-7 2-10 10-18 8-7-2-9-10-7-17 2-7 4-12 9-15z" fill="${col}" opacity="0.9"/>`
        : which === "africa"
          ? `<path d="M44 20c6-2 14 0 16 6 2 7-3 10-3 18 0 7-4 14-11 14-6 0-9-7-10-13-2-9 1-22 8-25z" fill="${col}" opacity="0.9"/>`
          : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}">
    <circle cx="50" cy="50" r="44" fill="rgba(10,10,16,0.85)" stroke="${col}" stroke-width="5"/>
    <ellipse cx="50" cy="50" rx="18" ry="44" fill="none" stroke="${col}" stroke-width="2.5" opacity="0.8"/>
    <ellipse cx="50" cy="50" rx="34" ry="44" fill="none" stroke="${col}" stroke-width="2" opacity="0.5"/>
    <line x1="6" y1="50" x2="94" y2="50" stroke="${col}" stroke-width="2.5" opacity="0.8"/>
    <path d="M12 30 Q50 20 88 30" fill="none" stroke="${col}" stroke-width="2" opacity="0.6"/>
    <path d="M12 70 Q50 80 88 70" fill="none" stroke="${col}" stroke-width="2" opacity="0.6"/>
    ${blob}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Renders the panel as a transparent PNG of the given size. */
export async function renderQualTable(spec: QualTableSpec, width: number, height: number): Promise<Buffer> {
  const [anton, mont800, mont600] = await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800), googleFont("Montserrat", 600)]);
  const n = spec.rows.length;
  const pad = Math.round(Math.min(18, width * 0.03));
  const totalH = spec.total ? Math.round(Math.min(130, height * 0.17)) : 0;
  const headerH = Math.round(Math.min(80, (height - totalH - pad * 2) / (n + 1.6)));
  const rowH = Math.min(170, Math.floor((height - totalH - headerH - pad * 2 - 10) / n));
  const iconH = Math.round(rowH * 0.56);
  const iconW = Math.round((iconH * 4) / 3);
  const accent = spec.accent;
  const onAccent = luma(accent) > 0.55 ? "#0b0b10" : "#ffffff";
  const icons = await Promise.all(
    spec.rows.map(async (r) => {
      if (!r.icon) return { kind: "none" as const, src: "" };
      if (r.icon.kind === "flag") {
        const png = await flagPng(r.icon.cc, Math.max(96, iconW * 2));
        if (png) return { kind: "flag" as const, src: `data:image/png;base64,${png.toString("base64")}` };
      }
      const png = await globePng(r.icon.kind === "globe" ? r.icon.which : "plain", Math.max(96, iconH * 2), accent);
      return { kind: "globe" as const, src: `data:image/png;base64,${png.toString("base64")}` };
    }),
  );
  const fsNum = Math.round(rowH * 0.58);
  const fsName = Math.round(rowH * 0.4);
  const fsHead = Math.round(Math.max(13, headerH * 0.34));
  const fsTotal = Math.round(Math.max(16, totalH * 0.42));
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width, height }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          borderRadius: 28,
          border: `3px solid ${rgba(accent, 0.85)}`,
          background: "rgba(6,6,12,0.74)",
          boxShadow: `0 0 0 3px rgba(0,0,0,0.45), 0 0 34px ${rgba(accent, 0.35)}`,
          overflow: "hidden",
          padding: pad,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: headerH, background: rgba(accent, 0.16), borderRadius: 16, paddingLeft: 22, paddingRight: 22, borderBottom: `2px solid ${rgba(accent, 0.5)}` }}>
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 4, color: "rgba(255,255,255,0.85)" }}>{spec.header.region}</div>
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 4, color: accent }}>{spec.header.unit}</div>
        </div>
        {spec.rows.map((r, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              height: rowH,
              background: idx % 2 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0)",
              borderBottom: idx === n - 1 ? "none" : `1px solid ${rgba(accent, 0.22)}`,
              paddingLeft: 16,
              paddingRight: 22,
            }}
          >
            <div style={{ display: "flex", width: iconW + 16, height: iconH, alignItems: "center", justifyContent: "flex-start" }}>
              {icons[idx].kind === "flag" ? (
                <img src={icons[idx].src} width={iconW} height={iconH} style={{ borderRadius: Math.round(iconH * 0.12), objectFit: "fill", border: "1px solid rgba(255,255,255,0.35)" }} />
              ) : icons[idx].kind === "globe" ? (
                <img src={icons[idx].src} width={iconH} height={iconH} style={{ objectFit: "contain" }} />
              ) : null}
            </div>
            <div style={{ display: "flex", flex: 1, marginLeft: 10, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsName, color: "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", letterSpacing: 1 }}>{r.name.slice(0, 26)}</div>
            <div style={{ display: "flex", justifyContent: "flex-end", minWidth: Math.round(rowH * 1.4), fontFamily: "Anton", fontSize: fsNum, color: accent, letterSpacing: 1 }}>{r.count}</div>
          </div>
        ))}
        {spec.total ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: totalH - pad, marginTop: pad, borderRadius: 16, background: `linear-gradient(90deg, ${rgba(accent, 0.95)}, ${rgba(accent, 0.75)})`, border: `2px solid rgba(255,255,255,0.35)` }}>
            <div style={{ display: "flex", fontFamily: "Anton", fontSize: fsTotal, color: onAccent, letterSpacing: 3, whiteSpace: "nowrap" }}>{spec.total.slice(0, 40)}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
  const res = new ImageResponse(el, {
    width,
    height,
    fonts: [
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "Montserrat", data: mont800, weight: 800, style: "normal" },
      { name: "Montserrat", data: mont600, weight: 600, style: "normal" },
    ],
  });
  return Buffer.from(await res.arrayBuffer());
}

/** Places the exact regions table on the finished background. */
export async function overlayQualTable(poster: Buffer, spec: QualTableSpec): Promise<Buffer> {
  const meta = await sharp(poster).metadata();
  const W = meta.width ?? 1632;
  const H = meta.height ?? 2040;
  const box = qualTableBox(spec.format);
  const x = Math.round(W * box.x);
  const y = Math.round(H * box.y);
  const w = Math.round(W * box.w);
  const h = Math.round(H * box.h);
  const table = await renderQualTable(spec, w, h);
  return sharp(poster).composite([{ input: table, left: x, top: y }]).png().toBuffer();
}
