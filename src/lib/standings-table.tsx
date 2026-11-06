// Exact standings table: KIXO draws the table itself — real crests, exact names and numbers — and places it on
// the AI-made background. The AI leaves the table area empty. Fonts come from Google Fonts at run time (TTF).
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cutoutCached } from "./cutout";
import type { BannerInputs } from "./templates";
import { legibleAccent } from "./legible";
import { tableBox } from "./standings-box";

export type TableRow = { pos: number; team: string; stats: Record<string, string>; crest: string | null };
export type TableSpec = {
  rows: TableRow[];
  /** Column keys present (subset of P W D L GD PTS, in that order) and their printed headers. */
  columns: { key: string; label: string }[];
  accent: string;
  qualify: number;
  legend: string;
  wide: boolean;
};

export { tableBox } from "./standings-box";

const KEYS = ["P", "W", "D", "L", "GD", "PTS"] as const;
const ES: Record<string, string> = { P: "PJ", W: "G", D: "E", L: "P", GD: "DG", PTS: "PTS" };

/** Reads the creator's "1. Team · P 9 · W 5 · … · PTS 16" rows into a table spec. */
export function tableSpecFrom(i: BannerInputs, accent: string, wide: boolean): TableSpec | null {
  const rows: TableRow[] = [];
  i.standings.forEach((line, n) => {
    if (!line.trim()) return;
    const parts = line.split("·").map((x) => x.trim());
    const team = parts[0].replace(/^\d+\.\s*/, "").trim();
    if (!team) return;
    const stats: Record<string, string> = {};
    for (const p of parts.slice(1)) {
      // "GD +6", "GD -3", "GD −3" (phone minus / dash), "L 0" — the sign survives, the stat is kept as typed.
      const m = p.match(/^([A-Za-z]+)\s*([+\-−–—]?)\s*(\d+)$/);
      if (m) stats[m[1].toUpperCase()] = `${m[2] === "+" ? "+" : m[2] ? "-" : ""}${m[3]}`;
    }
    rows.push({ pos: rows.length + 1, team, stats, crest: i.tableLogos?.[n] || null });
  });
  if (!rows.length) return null;
  const es = i.language === "Español";
  const columns = KEYS.filter((k) => rows.some((r) => r.stats[k] !== undefined)).map((k) => ({ key: k, label: es ? ES[k] : k }));
  // A stat left empty on a row whose column exists is a zero — a standings table never has holes.
  for (const r of rows) for (const c of columns) if (r.stats[c.key] === undefined) r.stats[c.key] = "0";
  const qualify = Math.min(rows.length, parseInt(i.qualify, 10) || 0);
  return { rows, columns, accent: legibleAccent(accent), qualify, legend: qualify ? (es ? `TOP ${qualify} AVANZAN` : `TOP ${qualify} ADVANCE`) : "", wide };
}

const fontCache = new Map<string, ArrayBuffer>();
/** A Google Font as TTF (Google serves TrueType to a non-browser client). */
export async function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const key = `${family}:${weight}`;
  const hit = fontCache.get(key);
  if (hit) return hit;
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, { signal: AbortSignal.timeout(12_000) })).text();
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/);
  if (!m) throw new Error(`font ${family} ${weight}: no TrueType source`);
  const buf = await (await fetch(m[1], { signal: AbortSignal.timeout(15_000) })).arrayBuffer();
  fontCache.set(key, buf);
  return buf;
}

/** True when the fonts the table needs can be loaded (checked before the AI is asked to leave the area empty). */
export async function tableFontsReady() {
  try {
    await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800), googleFont("Montserrat", 600)]);
    return true;
  } catch {
    return false;
  }
}

const hex = (c: string) => {
  const m = c.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { r: 255, g: 200, b: 60 };
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};

async function crestData(url: string, px: number): Promise<string | null> {
  try {
    const bytes = await cutoutCached(url); // just the emblem — no white / black square behind it
    const small = await sharp(bytes).resize(px, px, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    return `data:image/png;base64,${small.toString("base64")}`;
  } catch {
    return null;
  }
}

const mix = (c: string, t: string, k: number) => {
  const a = hex(c);
  const b = hex(t);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${f(a.r, b.r)}${f(a.g, b.g)}${f(a.b, b.b)}`;
};
const oct = (x: number, y: number, w: number, h: number, c: number) =>
  `M${(x + c).toFixed(1)},${y.toFixed(1)} H${(x + w - c).toFixed(1)} L${(x + w).toFixed(1)},${(y + c).toFixed(1)} V${(y + h - c).toFixed(1)} L${(x + w - c).toFixed(1)},${(y + h).toFixed(1)} H${(x + c).toFixed(1)} L${x.toFixed(1)},${(y + h - c).toFixed(1)} V${(y + c).toFixed(1)} Z`;

/**
 * The panel itself — a DESIGNED frame in the style's accent (like a broadcast graphic): dark glass body with a
 * lighter top, a bevelled metallic rim with cut corners and corner ornaments, an outer glow, a header strip
 * and the top-N rows outlined. Drawn as SVG under the text layer.
 */
function panelSvg(W: number, panelH: number, headerH: number, pad: number, rowTops: { y: number; h: number; top: boolean }[], accent: string) {
  const light = mix(accent, "#ffffff", 0.6);
  const dark = mix(accent, "#000000", 0.5);
  const c = Math.round(Math.min(W, panelH) * 0.028);
  const sw = Math.max(3, Math.round(W * 0.0035));
  const glow = Math.max(6, W * 0.012);
  const d = oct(sw, sw, W - sw * 2, panelH - sw * 2, c);
  const inner = oct(sw * 3.2, sw * 3.2, W - sw * 6.4, panelH - sw * 6.4, c * 0.8);
  const headY = pad;
  const headH = headerH;
  const o = sw * 4;
  const orn = (x: number, y: number, dir: 1 | -1, vdir: 1 | -1) =>
    `<path d="M${x},${y} l${o * dir},0 l${(-o / 2) * dir},${(o / 2) * vdir} Z" fill="${light}"/><circle cx="${x + o * 1.7 * dir}" cy="${y + o * 0.8 * vdir}" r="${Math.max(2, sw * 0.7)}" fill="${accent}"/><path d="M${x + o * 2.4 * dir},${y + o * 0.8 * vdir} l${o * 1.6 * dir},0" stroke="${accent}" stroke-opacity="0.8" stroke-width="${Math.max(1.5, sw * 0.5)}"/>`;
  const rows = rowTops
    .map(({ y, h, top }) =>
      top
        ? `<rect x="${pad + 2}" y="${y}" width="${W - pad * 2 - 4}" height="${h}" rx="${Math.round(h * 0.18)}" fill="${accent}" fill-opacity="0.14" stroke="${accent}" stroke-opacity="0.8" stroke-width="${Math.max(1.5, sw * 0.5)}"/>`
        : `<rect x="${pad + 2}" y="${y}" width="${W - pad * 2 - 4}" height="${h}" rx="${Math.round(h * 0.18)}" fill="#ffffff" fill-opacity="0.03" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1"/>`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${panelH}" viewBox="0 0 ${W} ${panelH}">
<defs>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a26" stop-opacity="0.86"/><stop offset="0.25" stop-color="#07070f" stop-opacity="0.86"/><stop offset="1" stop-color="#030308" stop-opacity="0.9"/></linearGradient>
<linearGradient id="head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.34"/><stop offset="1" stop-color="${accent}" stop-opacity="0.1"/></linearGradient>
<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${glow.toFixed(1)}"/></filter>
</defs>
<path d="${d}" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="${(sw * 2.5).toFixed(1)}" filter="url(#glow)"/>
<path d="${d}" fill="url(#glass)"/>
<rect x="${pad}" y="${headY}" width="${W - pad * 2}" height="${headH}" rx="${Math.round(headH * 0.22)}" fill="url(#head)"/>
<line x1="${pad + 6}" y1="${headY + headH + 1}" x2="${W - pad - 6}" y2="${headY + headH + 1}" stroke="${accent}" stroke-opacity="0.7" stroke-width="${Math.max(1.5, sw * 0.5)}"/>
${rows}
<path d="${inner}" fill="none" stroke="${dark}" stroke-opacity="0.9" stroke-width="${Math.max(1.5, sw * 0.5)}"/>
<path d="${d}" fill="none" stroke="url(#rim)" stroke-width="${(sw * 1.6).toFixed(1)}"/>
<path d="${oct(sw * 2.4, sw * 2.4, W - sw * 4.8, panelH - sw * 4.8, c * 0.9)}" fill="none" stroke="${light}" stroke-opacity="0.35" stroke-width="1"/>
${orn(c + sw * 2, sw * 2.2, 1, 1)}${orn(W - c - sw * 2, sw * 2.2, -1, 1)}${orn(c + sw * 2, panelH - sw * 2.2, 1, -1)}${orn(W - c - sw * 2, panelH - sw * 2.2, -1, -1)}
</svg>`;
}

/** Renders the table (designed frame + crests + exact text) as a transparent PNG of the given size. */
export async function renderStandingsTable(spec: TableSpec, width: number, height: number): Promise<Buffer> {
  const [anton, mont800, mont600] = await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800), googleFont("Montserrat", 600)]);
  const n = spec.rows.length;
  const legendH = spec.legend ? Math.round(Math.min(90, height * 0.07)) : 0;
  const panelH = height - legendH;
  const pad = Math.round(Math.max(10, width * 0.012));
  const gap = 4;
  const headerH = Math.round(Math.min(72, (panelH - pad * 2) / (n + 1.4)));
  const rowH = Math.min(150, Math.floor((panelH - pad * 2 - headerH - gap * (n + 1)) / n));
  const crestPx = Math.round(rowH * 0.78);
  const crests = await Promise.all(spec.rows.map((r) => (r.crest ? crestData(r.crest, Math.max(64, crestPx * 2)) : Promise.resolve(null))));
  const hasCrest = crests.some(Boolean); // the crest column exists only when a row has one
  const crestCol = hasCrest ? crestPx + 18 : 0;
  const statW = Math.round(Math.min(width * 0.085, rowH * 1.3));
  const posW = Math.round(rowH * 0.95);
  const fsNum = Math.round(rowH * 0.5);
  const rowPadL = 16;
  const rowPadR = 24;
  // The name column takes what is left; the name font shrinks (a little) so the longest name fits without "…".
  const nameW = width - pad * 2 - rowPadL - rowPadR - posW - crestCol - statW * spec.columns.length;
  const longest = Math.max(4, ...spec.rows.map((r) => r.team.slice(0, 26).length));
  const fsName = Math.round(Math.max(rowH * 0.26, Math.min(rowH * 0.44, nameW / (longest * 0.66))));
  const fsHead = Math.round(Math.max(14, headerH * 0.36));
  const accent = spec.accent;
  const rowTops = spec.rows.map((_, idx) => ({ y: pad + headerH + gap + idx * (rowH + gap), h: rowH, top: idx < spec.qualify }));
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width, height }}>
      <div style={{ display: "flex", flexDirection: "column", width, height: panelH, padding: pad }}>
        <div style={{ display: "flex", alignItems: "center", height: headerH, paddingLeft: rowPadL + 4, paddingRight: rowPadR }}>
          <div style={{ display: "flex", width: posW + crestCol }} />
          <div style={{ display: "flex", flex: 1, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 4, color: "rgba(255,255,255,0.8)" }}>TEAM</div>
          {spec.columns.map((c) => (
            <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 2, color: c.key === "PTS" ? accent : "rgba(255,255,255,0.8)" }}>
              {c.label}
            </div>
          ))}
        </div>
        {spec.rows.map((r, idx) => (
          <div key={r.pos} style={{ display: "flex", alignItems: "center", height: rowH, marginTop: gap, paddingLeft: rowPadL, paddingRight: rowPadR }}>
            <div style={{ display: "flex", width: posW, fontFamily: "Anton", fontSize: fsNum, color: accent, textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}>{`${r.pos}.`}</div>
            {hasCrest ? (
              <div style={{ display: "flex", width: crestPx, height: crestPx, alignItems: "center", justifyContent: "center", marginRight: 18 }}>
                {crests[idx] ? <img src={crests[idx]!} width={crestPx} height={crestPx} style={{ objectFit: "contain" }} /> : null}
              </div>
            ) : null}
            <div style={{ display: "flex", flex: 1, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsName, color: "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}>{r.team.slice(0, 26)}</div>
            {spec.columns.map((c) => (
              <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Montserrat", fontWeight: c.key === "PTS" ? 800 : 600, fontSize: c.key === "PTS" ? fsNum : Math.round(fsNum * 0.9), color: c.key === "PTS" ? accent : "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}>
                {r.stats[c.key] ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      {spec.legend ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: legendH }}>
          <div style={{ display: "flex", width: Math.round(legendH * 0.22), height: Math.round(legendH * 0.22), borderRadius: 999, background: accent, marginRight: 14 }} />
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: Math.round(Math.max(16, legendH * 0.36)), letterSpacing: 4, color: accent, textShadow: "0 2px 6px rgba(0,0,0,0.8)" }}>{spec.legend}</div>
        </div>
      ) : null}
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
  const text = Buffer.from(await res.arrayBuffer());
  const frame = await sharp(Buffer.from(panelSvg(width, panelH, headerH, pad, rowTops, accent))).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/** Places the exact table on the finished background. */
export async function overlayStandingsTable(poster: Buffer, spec: TableSpec): Promise<Buffer> {
  const meta = await sharp(poster).metadata();
  const W = meta.width ?? 1632;
  const H = meta.height ?? 2040;
  const box = tableBox(spec.wide);
  const x = Math.round(W * box.x);
  const y = Math.round(H * box.y);
  const w = Math.round(W * box.w);
  const h = Math.round(H * box.h);
  const table = await renderStandingsTable(spec, w, h);
  return sharp(poster).composite([{ input: table, left: x, top: y }]).png().toBuffer();
}
