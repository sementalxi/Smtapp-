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
  /** Two-column tables: the right column keeps the legend's height free (same panel height) without drawing it. */
  reserveLegend?: boolean;
  /** With no "how many advance", the leader's row glows — not in the right column of a two-column table. */
  leaderGlow?: boolean;
  /** A fixtures list instead of a standings table (STANDINGS styles reused for a matchday poster). */
  fixtures?: FixtureRow[];
};
export type FixtureRow = { home: string; away: string; note: string; homeCrest: string | null; awayCrest: string | null };

/** Reads "Home vs Away · 20:00" rows (crests: tableLogos[2n] home, [2n+1] away). */
export function fixturesFrom(i: BannerInputs): FixtureRow[] {
  const out: FixtureRow[] = [];
  (i.fixtures ?? []).forEach((line, n) => {
    if (!line || !line.trim()) return;
    const [match, ...rest] = line.split("·").map((x) => x.trim());
    const m = match.split(/\s+(?:vs\.?|v\.?|-|–|—)\s+/i);
    const home = (m[0] ?? "").trim();
    const away = (m.slice(1).join(" ").trim() || "TBD").trim();
    if (!home) return;
    out.push({ home, away, note: rest.join(" · ").slice(0, 16), homeCrest: i.tableLogos?.[2 * n] || null, awayCrest: i.tableLogos?.[2 * n + 1] || null });
  });
  return out;
}

export { tableBox } from "./standings-box";

const KEYS = ["P", "W", "D", "L", "GD", "PTS"] as const;
const ES: Record<string, string> = { P: "PJ", W: "G", D: "E", L: "P", GD: "DG", PTS: "PTS" };

/** Reads the creator's "1. Team · P 9 · W 5 · … · PTS 16" rows into a table spec. */
export function tableSpecFrom(i: BannerInputs, accent: string, wide: boolean): TableSpec | null {
  const fx = fixturesFrom(i);
  if (fx.length) return { rows: [], columns: [], accent: legibleAccent(accent), qualify: 0, legend: "", wide, fixtures: fx };
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

type Geo = { pad: number; headerH: number; rowH: number; n: number; qualify: number; glow: number; dividers: number[]; rowPadL: number; rowPadR: number };

/**
 * The panel itself, drawn as SVG under the text layer — the look of a broadcast table: a translucent dark body
 * (the poster's faded crest shows through), a bevelled metallic rim with cut corners and corner ornaments, a
 * header strip, thin column dividers, and NEON separator lines in the style's colour — the advancing rows sit
 * between bright glowing lines on a tinted band, the rest between dim lines.
 */
function panelSvg(W: number, panelH: number, g: Geo, accent: string) {
  const light = mix(accent, "#ffffff", 0.6);
  const lighter = mix(accent, "#ffffff", 0.82);
  const dark = mix(accent, "#000000", 0.5);
  const c = Math.round(Math.min(W, panelH) * 0.028);
  const sw = Math.max(3, Math.round(W * 0.0035));
  const glow = Math.max(6, W * 0.012);
  const d = oct(sw, sw, W - sw * 2, panelH - sw * 2, c);
  const inner = oct(sw * 3.2, sw * 3.2, W - sw * 6.4, panelH - sw * 6.4, c * 0.8);
  const x0 = g.pad + 2;
  const x1 = W - g.pad - 2;
  const y0 = g.pad + g.headerH; // the line under the header = the top of row 1
  const o = sw * 4;
  const orn = (x: number, y: number, dir: 1 | -1, vdir: 1 | -1) =>
    `<path d="M${x},${y} l${o * dir},0 l${(-o / 2) * dir},${(o / 2) * vdir} Z" fill="${light}"/><circle cx="${x + o * 1.7 * dir}" cy="${y + o * 0.8 * vdir}" r="${Math.max(2, sw * 0.7)}" fill="${accent}"/><path d="M${x + o * 2.4 * dir},${y + o * 0.8 * vdir} l${o * 1.6 * dir},0" stroke="${accent}" stroke-opacity="0.8" stroke-width="${Math.max(1.5, sw * 0.5)}"/>`;
  // the glowing band: a tint between the top line and the line under the last glowing row (the advancing rows, or the leader)
  const band = g.glow ? `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${g.rowH * g.glow}" fill="url(#band)"/>` : "";
  // separator lines: neon for the glowing rows (lines 0..glow), the style's colour, dimmer, for the rest
  const lineW = Math.max(2.5, W * 0.0032);
  const lines: string[] = [];
  for (let k = 0; k <= g.n; k++) {
    const y = (y0 + k * g.rowH).toFixed(1);
    if (k <= g.glow && g.glow) {
      const bar = (h: number, fill: string, op: number, filter?: string) =>
        `<rect x="${x0}" y="${(y0 + k * g.rowH - h / 2).toFixed(1)}" width="${x1 - x0}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}" fill="${fill}" fill-opacity="${op}"${filter ? ` filter="url(#${filter})"` : ""}/>`;
      lines.push(bar(lineW * 9, accent, 0.95, "halo"), bar(lineW * 4, accent, 1, "halo2"), bar(lineW * 2.4, accent, 1, "neon"), bar(lineW, lighter, 1));
      // flashes: two bright glints on every glowing line (a lens-flare streak and a four-point sparkle), spread along it
      const yc = y0 + k * g.rowH;
      const spots = [0.14 + ((k * 37) % 50) / 100 * 0.5, 0.62 + ((k * 53) % 30) / 100];
      spots.forEach((f, j) => {
        const cx = x0 + (x1 - x0) * f;
        const rx = W * (0.05 + ((k * 11) % 3) * 0.012);
        const ry = lineW * 3.2;
        const s = lineW * (3.5 + ((k * 7) % 3));
        lines.push(`<ellipse cx="${cx.toFixed(1)}" cy="${yc.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#flash)"/>`);
        // one small four-point sparkle per line, alternating left / right
        if (j === k % 2)
          lines.push(
            `<path d="M${cx.toFixed(1)},${(yc - s).toFixed(1)} L${(cx + s * 0.18).toFixed(1)},${yc.toFixed(1)} L${cx.toFixed(1)},${(yc + s).toFixed(1)} L${(cx - s * 0.18).toFixed(1)},${yc.toFixed(1)} Z M${(cx - s * 2.2).toFixed(1)},${yc.toFixed(1)} L${cx.toFixed(1)},${(yc - s * 0.16).toFixed(1)} L${(cx + s * 2.2).toFixed(1)},${yc.toFixed(1)} L${cx.toFixed(1)},${(yc + s * 0.16).toFixed(1)} Z" fill="#ffffff" fill-opacity="0.95"/>`,
          );
      });
    } else {
      lines.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${accent}" stroke-opacity="0.45" stroke-width="${Math.max(1, lineW * 0.55).toFixed(1)}"/>`);
    }
  }
  // thin column dividers through the stats
  const divs = g.dividers.map((x) => `<line x1="${x.toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${(y0 + g.rowH * g.n).toFixed(1)}" stroke="${accent}" stroke-opacity="0.5" stroke-width="${Math.max(1, lineW * 0.45).toFixed(1)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${panelH}" viewBox="0 0 ${W} ${panelH}">
<defs>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101018" stop-opacity="0.72"/><stop offset="0.3" stop-color="#05050c" stop-opacity="0.6"/><stop offset="1" stop-color="#03030a" stop-opacity="0.72"/></linearGradient>
<linearGradient id="head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity="0.38"/><stop offset="1" stop-color="${accent}" stop-opacity="0.12"/></linearGradient>
<linearGradient id="band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity="0.42"/><stop offset="0.5" stop-color="${accent}" stop-opacity="0.2"/><stop offset="1" stop-color="${accent}" stop-opacity="0.42"/></linearGradient>
<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${glow.toFixed(1)}"/></filter>
<radialGradient id="flash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="0.3" stop-color="${lighter}" stop-opacity="0.9"/><stop offset="0.6" stop-color="${accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<filter id="halo" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${panelH}"><feGaussianBlur stdDeviation="${(W * 0.016).toFixed(1)}"/></filter>
<filter id="halo2" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${panelH}"><feGaussianBlur stdDeviation="${(W * 0.007).toFixed(1)}"/></filter>
<filter id="neon" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${panelH}"><feGaussianBlur stdDeviation="${(W * 0.0045).toFixed(1)}"/></filter>
</defs>
<path d="${d}" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="${(sw * 2.5).toFixed(1)}" filter="url(#glow)"/>
<path d="${d}" fill="url(#glass)"/>
<rect x="${g.pad}" y="${g.pad}" width="${W - g.pad * 2}" height="${g.headerH}" rx="${Math.round(g.headerH * 0.22)}" fill="#05050c" fill-opacity="0.9"/>
<rect x="${g.pad}" y="${g.pad}" width="${W - g.pad * 2}" height="${g.headerH}" rx="${Math.round(g.headerH * 0.22)}" fill="url(#head)"/>
${band}
${divs}
${lines.join("\n")}
<path d="${inner}" fill="none" stroke="${dark}" stroke-opacity="0.9" stroke-width="${Math.max(1.5, sw * 0.5)}"/>
<path d="${d}" fill="none" stroke="url(#rim)" stroke-width="${(sw * 1.6).toFixed(1)}"/>
<path d="${oct(sw * 2.4, sw * 2.4, W - sw * 4.8, panelH - sw * 4.8, c * 0.9)}" fill="none" stroke="${light}" stroke-opacity="0.35" stroke-width="1"/>
${orn(c + sw * 2, sw * 2.2, 1, 1)}${orn(W - c - sw * 2, sw * 2.2, -1, 1)}${orn(c + sw * 2, panelH - sw * 2.2, 1, -1)}${orn(W - c - sw * 2, panelH - sw * 2.2, -1, -1)}
</svg>`;
}

/** A crest with a soft glow in the style's colour behind it (data URL for the text layer). */
async function crestGlow(data: string, px: number, accent: string): Promise<string> {
  try {
    const bytes = Buffer.from(data.split(",")[1], "base64");
    const m = await sharp(bytes).metadata();
    const w = m.width ?? px;
    const h = m.height ?? px;
    const pad = Math.round(Math.max(w, h) * 0.18);
    const { r, g, b } = hex(accent);
    const sil = await sharp({ create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 0.85 } } }).composite([{ input: bytes, blend: "dest-in" }]).png().toBuffer();
    const glow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: sil, left: pad, top: pad }]).blur(pad * 0.45).png().toBuffer();
    const shadow = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.8 } } }).composite([{ input: bytes, blend: "dest-in" }]).png().toBuffer(), left: pad, top: pad + Math.round(pad * 0.3) }]).blur(pad * 0.3).png().toBuffer();
    const out = await sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: shadow }, { input: glow }, { input: bytes, left: pad, top: pad }])
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString("base64")}`;
  } catch {
    return data;
  }
}

/** Renders the table (designed frame + crests + exact text) as a transparent PNG of the given size. */
export async function renderStandingsTable(spec: TableSpec, width: number, height: number): Promise<Buffer> {
  const [anton, mont800] = await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800)]);
  const n = spec.rows.length;
  const legendH = spec.legend || spec.reserveLegend ? Math.round(Math.min(90, height * 0.07)) : 0;
  const panelH = height - legendH;
  const pad = Math.round(Math.max(12, width * 0.014));
  const headerH = Math.round(Math.min(72, (panelH - pad * 2) / (n + 1.4)));
  const rowH = Math.min(150, Math.floor((panelH - pad * 2 - headerH) / n));
  const crestPx = Math.round(rowH * 0.84);
  const accent = spec.accent;
  const crests = await Promise.all(spec.rows.map(async (r) => (r.crest ? crestGlow((await crestData(r.crest, Math.max(64, crestPx * 2))) ?? "", crestPx, accent) : null)));
  const hasCrest = crests.some(Boolean); // the crest column exists only when a row has one
  const crestBox = Math.round(crestPx * 1.36); // the glow needs room around the crest
  const crestCol = hasCrest ? crestBox + 14 : 0;
  const statW = Math.round(Math.min(width * 0.085, rowH * 1.3));
  const posW = Math.round(rowH * 0.95);
  const fsNum = Math.round(rowH * 0.56);
  const rowPadL = 18;
  const rowPadR = 10;
  // The name column takes what is left; Anton is condensed, so the name font shrinks only for very long names.
  const nameW = width - pad * 2 - rowPadL - rowPadR - posW - crestCol - statW * spec.columns.length;
  const longest = Math.max(4, ...spec.rows.map((r) => r.team.slice(0, 26).length));
  const fsName = Math.round(Math.max(rowH * 0.3, Math.min(rowH * 0.5, nameW / (longest * 0.5))));
  const fsHead = Math.round(Math.max(14, headerH * 0.4));
  const dividers = spec.columns.map((_, k) => width - pad - rowPadR - statW * (spec.columns.length - k));
  const glow = spec.qualify || (n && spec.leaderGlow !== false ? 1 : 0); // "how many advance" rows glow; with none given, the leader does
  const geo: Geo = { pad, headerH, rowH, n, qualify: spec.qualify, glow, dividers, rowPadL, rowPadR };
  const shadow = "0 2px 5px rgba(0,0,0,0.85)";
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width, height }}>
      <div style={{ display: "flex", flexDirection: "column", width, height: panelH, padding: pad }}>
        <div style={{ display: "flex", alignItems: "center", height: headerH, paddingLeft: rowPadL + 4, paddingRight: rowPadR }}>
          <div style={{ display: "flex", width: posW + crestCol }} />
          <div style={{ display: "flex", flex: 1, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 4, color: "rgba(255,255,255,0.85)", textShadow: shadow }}>TEAM</div>
          {spec.columns.map((c) => (
            <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 2, color: c.key === "PTS" ? accent : "rgba(255,255,255,0.85)", textShadow: shadow }}>
              {c.label}
            </div>
          ))}
        </div>
        {spec.rows.map((r, idx) => (
          <div key={r.pos} style={{ display: "flex", alignItems: "center", height: rowH, paddingLeft: rowPadL, paddingRight: rowPadR }}>
            <div style={{ display: "flex", width: posW, fontFamily: "Anton", fontSize: fsNum, color: idx < glow ? accent : "rgba(255,255,255,0.9)", textShadow: idx < glow ? `0 0 14px ${accent}, ${shadow}` : shadow }}>{`${r.pos}.`}</div>
            {hasCrest ? (
              <div style={{ display: "flex", width: crestBox, height: crestBox, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                {crests[idx] ? <img src={crests[idx]!} width={crestBox} height={crestBox} style={{ objectFit: "contain" }} /> : null}
              </div>
            ) : null}
            <div style={{ display: "flex", flex: 1, fontFamily: "Anton", fontSize: fsName, color: "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", letterSpacing: 1, textShadow: shadow }}>{r.team.slice(0, 26)}</div>
            {spec.columns.map((c) => (
              <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Anton", fontSize: c.key === "PTS" ? fsNum : Math.round(fsNum * 0.92), color: c.key === "PTS" ? accent : "#ffffff", textShadow: c.key === "PTS" ? `0 0 14px ${accent}, ${shadow}` : shadow }}>
                {r.stats[c.key] ?? ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      {spec.legend ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: legendH }}>
          <div style={{ display: "flex", width: Math.round(legendH * 0.22), height: Math.round(legendH * 0.22), borderRadius: 999, background: accent, marginRight: 14, boxShadow: `0 0 12px ${accent}` }} />
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: Math.round(Math.max(16, legendH * 0.36)), letterSpacing: 4, color: accent, textShadow: `0 0 14px ${accent}, 0 2px 6px rgba(0,0,0,0.8)` }}>{spec.legend}</div>
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
    ],
  });
  const text = Buffer.from(await res.arrayBuffer());
  const frame = await sharp(Buffer.from(panelSvg(width, panelH, geo, accent))).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/** Two-letter badge text for a team without a crest ("Real Madrid" → "RM", "Bronze" → "BR"). */
function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

/** The designed layer of a fixtures list: one glass plate per team, a glowing VS medallion between them, shields for teams with no crest. */
function fixturesSvg(W: number, H: number, rows: { y: number; homeShield: boolean; awayShield: boolean }[], g: { rowH: number; medal: number; badge: number; padX: number }, accent: string) {
  const light = mix(accent, "#ffffff", 0.6);
  const lighter = mix(accent, "#ffffff", 0.85);
  const dark = mix(accent, "#000000", 0.55);
  const cx = W / 2;
  const sw = Math.max(2, W * 0.0028);
  const cut = g.rowH * 0.22;
  const plateGap = g.medal * 0.36; // plates tuck under the medallion
  const parts: string[] = [];
  const shield = (x: number, y: number, s: number) =>
    `<path d="M${(x + s * 0.5).toFixed(1)},${y.toFixed(1)} L${(x + s).toFixed(1)},${(y + s * 0.16).toFixed(1)} L${(x + s * 0.93).toFixed(1)},${(y + s * 0.66).toFixed(1)} L${(x + s * 0.5).toFixed(1)},${(y + s).toFixed(1)} L${(x + s * 0.07).toFixed(1)},${(y + s * 0.66).toFixed(1)} L${x.toFixed(1)},${(y + s * 0.16).toFixed(1)} Z" fill="url(#shield)" stroke="${light}" stroke-width="${(sw * 0.9).toFixed(1)}"/>`;
  rows.forEach((r, k) => {
    const y0 = r.y;
    const y1 = r.y + g.rowH;
    const lx1 = cx - plateGap;
    const rx0 = cx + plateGap;
    // left plate: square outer end, slanted inner end; right plate mirrored
    const left = `M0,${(y0 + cut).toFixed(1)} L${cut.toFixed(1)},${y0.toFixed(1)} L${lx1.toFixed(1)},${y0.toFixed(1)} L${(lx1 - cut * 1.2).toFixed(1)},${y1.toFixed(1)} L0,${y1.toFixed(1)} Z`;
    const right = `M${(rx0 + cut * 1.2).toFixed(1)},${y0.toFixed(1)} L${W.toFixed(1)},${y0.toFixed(1)} L${W.toFixed(1)},${(y1 - cut).toFixed(1)} L${(W - cut).toFixed(1)},${y1.toFixed(1)} L${rx0.toFixed(1)},${y1.toFixed(1)} Z`;
    for (const [d, grad] of [[left, "plateL"], [right, "plateR"]] as const) {
      parts.push(`<path d="${d}" fill="${accent}" fill-opacity="0.35" filter="url(#soft)"/>`);
      parts.push(`<path d="${d}" fill="url(#${grad})"/>`);
      parts.push(`<path d="${d}" fill="none" stroke="url(#edge)" stroke-width="${sw.toFixed(1)}"/>`);
    }
    // bright top highlight on each plate
    parts.push(`<line x1="${(cut + 4).toFixed(1)}" y1="${(y0 + sw).toFixed(1)}" x2="${(lx1 - 6).toFixed(1)}" y2="${(y0 + sw).toFixed(1)}" stroke="${lighter}" stroke-opacity="0.55" stroke-width="${(sw * 0.6).toFixed(1)}"/>`);
    parts.push(`<line x1="${(rx0 + cut * 1.2 + 6).toFixed(1)}" y1="${(y0 + sw).toFixed(1)}" x2="${(W - 4).toFixed(1)}" y2="${(y0 + sw).toFixed(1)}" stroke="${lighter}" stroke-opacity="0.55" stroke-width="${(sw * 0.6).toFixed(1)}"/>`);
    const by = y0 + (g.rowH - g.badge) / 2;
    if (r.homeShield) parts.push(shield(g.padX, by, g.badge));
    if (r.awayShield) parts.push(shield(W - g.padX - g.badge, by, g.badge));
    // medallion
    const cy = y0 + g.rowH / 2;
    const rr = g.medal / 2;
    parts.push(`<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${(rr * 1.25).toFixed(1)}" fill="${accent}" fill-opacity="0.55" filter="url(#halo)"/>`);
    parts.push(`<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}" fill="url(#medal)" stroke="${lighter}" stroke-width="${(sw * 1.2).toFixed(1)}"/>`);
    parts.push(`<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${(rr * 0.8).toFixed(1)}" fill="none" stroke="${light}" stroke-opacity="0.6" stroke-width="${(sw * 0.6).toFixed(1)}"/>`);
    void k;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="plateL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#05050c" stop-opacity="0.86"/><stop offset="0.7" stop-color="#0b0b16" stop-opacity="0.8"/><stop offset="1" stop-color="${dark}" stop-opacity="0.85"/></linearGradient>
<linearGradient id="plateR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#05050c" stop-opacity="0.86"/><stop offset="0.7" stop-color="#0b0b16" stop-opacity="0.8"/><stop offset="1" stop-color="${dark}" stop-opacity="0.85"/></linearGradient>
<linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighter}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<linearGradient id="shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.45" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<radialGradient id="medal" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${lighter}"/><stop offset="0.35" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
<filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${(W * 0.008).toFixed(1)}"/></filter>
<filter id="halo" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${(g.medal * 0.22).toFixed(1)}"/></filter>
</defs>
${parts.join("\n")}
</svg>`;
}

/** Renders a fixtures list: per match a home plate, a glowing VS (or kick-off time) medallion and an away plate, crests or initial shields at the outer ends. */
export async function renderFixturesTable(spec: TableSpec, width: number, height: number): Promise<Buffer> {
  const [anton, mont800] = await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800)]);
  const fixtures = spec.fixtures ?? [];
  const n = Math.max(1, fixtures.length);
  const gapK = 0.2;
  const rowH = Math.round(Math.min(150, height / (n + (n - 1) * gapK)));
  const gap = Math.round(rowH * gapK);
  const panelH = n * rowH + (n - 1) * gap;
  const accent = spec.accent;
  const badge = Math.round(rowH * 0.82);
  const medal = Math.round(rowH * 1.02);
  const padX = Math.round(rowH * 0.22);
  const crestFor = async (url: string | null) => (url ? crestGlow((await crestData(url, Math.max(64, badge * 2))) ?? "", badge, accent) : null);
  const crests = await Promise.all(fixtures.map(async (f) => Promise.all([crestFor(f.homeCrest), crestFor(f.awayCrest)])));
  const nameW = width / 2 - medal * 0.62 - padX - badge - rowH * 0.28;
  const longest = Math.max(4, ...fixtures.flatMap((f) => [f.home.slice(0, 22).length, f.away.slice(0, 22).length]));
  const fsName = Math.round(Math.max(rowH * 0.3, Math.min(rowH * 0.56, nameW / (longest * 0.47))));
  const shadow = "0 3px 6px rgba(0,0,0,0.9)";
  const rows = fixtures.map((_, idx) => ({ y: idx * (rowH + gap), homeShield: !crests[idx][0], awayShield: !crests[idx][1] }));
  const badgeCell = (src: string | null, name: string) => (
    <div style={{ display: "flex", width: badge, height: badge, alignItems: "center", justifyContent: "center" }}>
      {src ? (
        <img src={src} width={Math.round(badge * 1.18)} height={Math.round(badge * 1.18)} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ display: "flex", marginTop: -Math.round(badge * 0.06), fontFamily: "Anton", fontSize: Math.round(badge * 0.38), color: "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.85)" }}>{initials(name)}</div>
      )}
    </div>
  );
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width, height: panelH }}>
      {fixtures.map((f, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", height: rowH, marginTop: idx ? gap : 0, paddingLeft: padX, paddingRight: padX }}>
          {badgeCell(crests[idx][0], f.home)}
          <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", paddingRight: Math.round(rowH * 0.18), fontFamily: "Anton", fontSize: fsName, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", letterSpacing: 1, textShadow: shadow }}>{f.home.slice(0, 22).toUpperCase()}</div>
          <div style={{ display: "flex", width: medal, justifyContent: "center", alignItems: "center", fontFamily: "Anton", fontSize: Math.round(f.note ? medal * (f.note.length > 5 ? 0.24 : 0.3) : medal * 0.4), color: "#ffffff", textShadow: `0 0 10px ${accent}, 0 2px 4px rgba(0,0,0,0.9)` }}>{f.note || "VS"}</div>
          <div style={{ display: "flex", flex: 1, paddingLeft: Math.round(rowH * 0.18), fontFamily: "Anton", fontSize: fsName, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", letterSpacing: 1, textShadow: shadow }}>{f.away.slice(0, 22).toUpperCase()}</div>
          {badgeCell(crests[idx][1], f.away)}
        </div>
      ))}
    </div>
  );
  const res = new ImageResponse(el, {
    width,
    height: panelH,
    fonts: [
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "Montserrat", data: mont800, weight: 800, style: "normal" },
    ],
  });
  const text = Buffer.from(await res.arrayBuffer());
  const frame = await sharp(Buffer.from(fixturesSvg(width, panelH, rows, { rowH, medal, badge, padX }, accent))).png().toBuffer();
  return sharp({ create: { width, height: panelH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/** Places the exact table on the finished background. */
export async function overlayStandingsTable(poster: Buffer, spec: TableSpec): Promise<Buffer> {
  // The glow takes the poster's own colour (what the AI actually painted), lifted if it is too dark for text.
  const { posterAccent } = await import("./ref-palette");
  spec = { ...spec, accent: legibleAccent(await posterAccent(poster, spec.accent)) };
  const meta = await sharp(poster).metadata();
  const W = meta.width ?? 1632;
  const H = meta.height ?? 2040;
  const box = tableBox(spec.wide);
  const x = Math.round(W * box.x);
  const y = Math.round(H * box.y);
  const w = Math.round(W * box.w);
  const h = Math.round(H * box.h);
  if (spec.fixtures?.length) {
    // More than 10 fixtures: two columns side by side, like a big league table.
    if (spec.fixtures.length > 10 && !spec.wide) {
      const half = Math.ceil(spec.fixtures.length / 2);
      const gap = Math.round(w * 0.025);
      const cw = Math.floor((w - gap) / 2);
      const [a, b] = await Promise.all([
        renderFixturesTable({ ...spec, fixtures: spec.fixtures.slice(0, half) }, cw, h),
        renderFixturesTable({ ...spec, fixtures: spec.fixtures.slice(half) }, cw, h),
      ]);
      return sharp(poster).composite([{ input: a, left: x, top: y }, { input: b, left: x + cw + gap, top: y }]).png().toBuffer();
    }
    const list = await renderFixturesTable(spec, w, h);
    const listH = (await sharp(list).metadata()).height ?? h;
    return sharp(poster).composite([{ input: list, left: x, top: y + Math.max(0, Math.round((h - listH) / 2)) }]).png().toBuffer();
  }
  // Big leagues (17–32 teams): two columns side by side, so the rows stay tall enough to read.
  if (spec.rows.length > 16) {
    const half = Math.ceil(spec.rows.length / 2);
    const gap = Math.round(w * 0.025);
    const cw = Math.floor((w - gap) / 2);
    const left: TableSpec = { ...spec, rows: spec.rows.slice(0, half), qualify: Math.min(spec.qualify, half) };
    const right: TableSpec = { ...spec, rows: spec.rows.slice(half), qualify: Math.max(0, spec.qualify - half), legend: "", reserveLegend: !!spec.legend, leaderGlow: false };
    const [a, b] = await Promise.all([renderStandingsTable(left, cw, h), renderStandingsTable(right, cw, h)]);
    return sharp(poster)
      .composite([
        { input: a, left: x, top: y },
        { input: b, left: x + cw + gap, top: y },
      ])
      .png()
      .toBuffer();
  }
  const table = await renderStandingsTable(spec, w, h);
  return sharp(poster).composite([{ input: table, left: x, top: y }]).png().toBuffer();
}
