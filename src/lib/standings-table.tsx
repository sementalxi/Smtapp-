// Exact standings table: KIXO draws the table itself — real crests, exact names and numbers — and places it on
// the AI-made background. The AI leaves the table area empty. Fonts come from Google Fonts at run time (TTF).
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cutoutCached } from "./cutout";
import type { BannerInputs } from "./templates";

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

/** Where the table goes on the poster (fractions of width / height). */
export function tableBox(wide: boolean) {
  return wide ? { x: 0.4, y: 0.1, w: 0.56, h: 0.8 } : { x: 0.06, y: 0.37, w: 0.88, h: 0.5 };
}

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
      const m = p.match(/^([A-Z]+)\s+(-?\d+)$/);
      if (m) stats[m[1]] = m[2];
    }
    rows.push({ pos: rows.length + 1, team, stats, crest: i.tableLogos?.[n] || null });
  });
  if (!rows.length) return null;
  const es = i.language === "Español";
  const columns = KEYS.filter((k) => rows.some((r) => r.stats[k] !== undefined)).map((k) => ({ key: k, label: es ? ES[k] : k }));
  const qualify = Math.min(rows.length, parseInt(i.qualify, 10) || 0);
  return { rows, columns, accent, qualify, legend: qualify ? (es ? `TOP ${qualify} AVANZAN` : `TOP ${qualify} ADVANCE`) : "", wide };
}

const fontCache = new Map<string, ArrayBuffer>();
/** A Google Font as TTF (Google serves TrueType to a non-browser client). */
async function googleFont(family: string, weight: number): Promise<ArrayBuffer> {
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
const rgba = (c: string, a: number) => {
  const { r, g, b } = hex(c);
  return `rgba(${r},${g},${b},${a})`;
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

/** Renders the table as a transparent PNG of the given size. */
export async function renderStandingsTable(spec: TableSpec, width: number, height: number): Promise<Buffer> {
  const [anton, mont800, mont600] = await Promise.all([googleFont("Anton", 400), googleFont("Montserrat", 800), googleFont("Montserrat", 600)]);
  const n = spec.rows.length;
  const legendH = spec.legend ? Math.round(Math.min(90, height * 0.07)) : 0;
  const headerH = Math.round(Math.min(72, (height - legendH) / (n + 1.4)));
  const panelPad = 6;
  const rowH = Math.min(150, Math.floor((height - legendH - headerH - panelPad * 2 - 6) / n));
  const crestPx = Math.round(rowH * 0.8);
  const crests = await Promise.all(spec.rows.map((r) => (r.crest ? crestData(r.crest, Math.max(64, crestPx * 2)) : Promise.resolve(null))));
  const statW = Math.round(Math.min(width * 0.1, rowH * 1.6));
  const posW = Math.round(rowH * 1.05);
  const fsNum = Math.round(rowH * 0.5);
  const fsName = Math.round(rowH * 0.44);
  const fsHead = Math.round(Math.max(14, headerH * 0.36));
  const accent = spec.accent;
  const el = (
    <div style={{ display: "flex", flexDirection: "column", width, height }}>
      <div style={{ display: "flex", flexDirection: "column", borderRadius: 26, border: `3px solid ${rgba(accent, 0.75)}`, background: "rgba(4,4,10,0.66)", overflow: "hidden", padding: panelPad }}>
        <div style={{ display: "flex", alignItems: "center", height: headerH, background: "rgba(255,255,255,0.07)", borderRadius: 18, paddingLeft: 18, paddingRight: 22 }}>
          <div style={{ display: "flex", width: posW + crestPx + 18 }} />
          <div style={{ display: "flex", flex: 1, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 4, color: "rgba(255,255,255,0.72)" }}>TEAM</div>
          {spec.columns.map((c) => (
            <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Montserrat", fontWeight: 800, fontSize: fsHead, letterSpacing: 2, color: c.key === "PTS" ? accent : "rgba(255,255,255,0.72)" }}>
              {c.label}
            </div>
          ))}
        </div>
        {spec.rows.map((r, idx) => {
          const top = idx < spec.qualify;
          return (
            <div
              key={r.pos}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                background: top ? rgba(accent, 0.17) : idx % 2 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0)",
                borderLeft: `8px solid ${top ? accent : "rgba(0,0,0,0)"}`,
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingLeft: 10,
                paddingRight: 22,
              }}
            >
              <div style={{ display: "flex", width: posW, fontFamily: "Anton", fontSize: fsNum, color: top ? accent : "#ffffff" }}>{`${r.pos}.`}</div>
              <div style={{ display: "flex", width: crestPx, height: crestPx, alignItems: "center", justifyContent: "center", marginRight: 18 }}>
                {crests[idx] ? <img src={crests[idx]!} width={crestPx} height={crestPx} style={{ objectFit: "contain" }} /> : null}
              </div>
              <div style={{ display: "flex", flex: 1, fontFamily: "Montserrat", fontWeight: 800, fontSize: fsName, color: "#ffffff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.team.slice(0, 26)}</div>
              {spec.columns.map((c) => (
                <div key={c.key} style={{ display: "flex", width: statW, justifyContent: "center", fontFamily: "Montserrat", fontWeight: c.key === "PTS" ? 800 : 600, fontSize: c.key === "PTS" ? fsNum : Math.round(fsNum * 0.9), color: c.key === "PTS" ? accent : "#ffffff" }}>
                  {r.stats[c.key] ?? ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {spec.legend ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: legendH }}>
          <div style={{ display: "flex", width: Math.round(legendH * 0.22), height: Math.round(legendH * 0.22), borderRadius: 999, background: accent, marginRight: 14 }} />
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: Math.round(Math.max(16, legendH * 0.36)), letterSpacing: 4, color: accent }}>{spec.legend}</div>
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
  return Buffer.from(await res.arrayBuffer());
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
