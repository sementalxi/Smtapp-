// AI welcome banners for the Discord server: every new member gets a unique banner — a different look each time,
// their name as the big 3D title, "WELCOME TO KIXO" — made by the image model, and KIXO pastes the exact parts:
// the member's own profile picture in a glowing ring, the member number and the KIXO logo. The member's picture
// is never sent to the AI (it is only shown as it is, like on the old banner), so no face is ever redrawn.
import sharp from "sharp";
import { ImageResponse } from "next/og";
import { BLOCKED, generatePoster } from "./ai";
import { BRAND_LOGO_PNG_BASE64 } from "./brand-logo";
import { db } from "./db";
import { googleFont } from "./standings-table";
import { saveFile } from "./storage";
import { welcomeFxLayers } from "./welcome-fx";

export const WELCOME_W = 2048;
export const WELCOME_H = 1024;
/** The profile picture's circle: centre and diameter as fractions of the banner's width / height. */
const AV = { cx: 0.235, cy: 0.45, d: 0.52 };

type Look = { key: string; scene: string; letters: string; accent: string };

/** The looks a banner can take — one is picked at random (never the same as the last one). */
export const WELCOME_LOOKS: Look[] = [
  { key: "pink-chrome", scene: "KIXO's signature look: a black-and-magenta studio with hot-pink neon light blades slicing diagonally across, pink haze, a glossy wet black floor reflecting the light, flying pink sparks", letters: "mirror-polished chrome with a hot-pink neon edge glow and deep bevels", accent: "#ff2e88" },
  { key: "gold-luxury", scene: "a black marble hall with gold veins, golden light rays from above, floating gold dust and confetti, a soft champagne glow", letters: "polished 3D gold with sharp bevels, specular highlights and a warm glow", accent: "#f2c14e" },
  { key: "electric", scene: "a night arena under a storm: violent electric lightning bolts, crackling energy arcs, smoke, sparks and floodlight beams", letters: "white chrome with an electric-blue energy glow and lightning crackling across the letters", accent: "#38b6ff" },
  { key: "inferno", scene: "a dark volcanic arena: molten lava cracks in the floor, roaring orange fire, thick smoke and flying embers", letters: "black steel with glowing molten-orange edges, cracks of fire inside the letters", accent: "#ff7a1a" },
  { key: "galaxy", scene: "deep space: a violet and pink nebula, bright stars, a glowing planet rim and cosmic energy streaks", letters: "purple crystal glass with chrome bevels and a starry inner glow", accent: "#a45cff" },
  { key: "ice", scene: "a frozen cavern: crystal ice shards in the corners, frost particles, cold white-cyan light beams and mist", letters: "ice-chrome with frosted edges and a cold cyan glow", accent: "#7fe7ff" },
  { key: "toxic", scene: "a dark underground arena with acid-green neon tubes, toxic green smoke rolling across the floor and green sparks", letters: "black chrome with a radioactive green neon outline", accent: "#4dff6a" },
  { key: "red-stadium", scene: "a stadium at night: blazing floodlights, red smoke and flares, red confetti raining down, a packed-stand bokeh far behind", letters: "brushed silver with a deep red extrusion and a hard drop shadow", accent: "#ff2a3d" },
  { key: "street", scene: "a wet city street wall at night covered in spray-paint splashes and drips in pink, yellow and cyan, neon signs glowing in the puddles", letters: "bold 3D graffiti block letters with a thick outline, paint drips and a glossy highlight", accent: "#ffd22e" },
  { key: "rose-gold", scene: "flowing champagne and rose-gold silk, soft bokeh lights, floating sparkles and a warm luxury glow", letters: "rose-gold chrome with soft pink reflections and fine bevels", accent: "#ff9db8" },
];

const hexOf = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
function hsv(r: number, g: number, b: number) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx / 255 };
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * The profile picture's colours (only measured here — the picture itself never goes to the AI): its one or two
 * strongest colours, or [] for a black / white / grey picture.
 */
export async function avatarColours(avatar: Buffer | null): Promise<{ hex: string[]; hue: number | null }> {
  if (!avatar) return { hex: [], hue: null };
  try {
    const { data } = await sharp(avatar).resize(40, 40, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let strong = 0;
    for (let i = 0; i < data.length; i += 3) {
      const { h, s, v } = hsv(data[i], data[i + 1], data[i + 2]);
      if (s < 0.35 || v < 0.25) continue;
      strong++;
      const bin = bins[Math.floor(h / 30) % 12], w = s * v;
      bin.w += w; bin.r += data[i] * w; bin.g += data[i + 1] * w; bin.b += data[i + 2] * w;
    }
    if (strong < (data.length / 3) * 0.12) return { hex: [], hue: null };
    const top = bins.map((b, k) => ({ ...b, k })).filter((b) => b.w > 0).sort((a, b) => b.w - a.w);
    const pick = top.filter((b, i) => i === 0 || (b.w > top[0].w * 0.3 && Math.abs(b.k - top[0].k) % 12 > 1 && Math.abs(b.k - top[0].k) % 12 < 11)).slice(0, 2);
    const hex = pick.map((b) => {
      // brightened so the glow reads as light, not mud
      const r = b.r / b.w, g = b.g / b.w, bl = b.b / b.w, mx = Math.max(r, g, bl, 1), f = Math.min(2.2, 235 / mx);
      return hexOf(r * f, g * f, bl * f);
    });
    const c = pick[0];
    return { hex, hue: hsv(c.r / c.w, c.g / c.w, c.b / c.w).h };
  } catch {
    return { hex: [], hue: null };
  }
}

/** The look that suits the profile picture best (closest colour; a neutral picture gets a chrome-style look). */
export function lookForAvatar(hue: number | null, last: string): Look {
  const pool = WELCOME_LOOKS.filter((l) => l.key !== last);
  if (hue === null) {
    const mono = pool.filter((l) => ["ice", "electric", "pink-chrome", "gold-luxury"].includes(l.key));
    return mono[Math.floor(Math.random() * mono.length)] ?? pool[0];
  }
  const ranked = pool
    .filter((l) => l.key !== "street") // multicolour: never "the" colour of a picture
    .map((l) => { const a = l.accent.replace("#", ""); return { l, gap: hueGap(hsv(parseInt(a.slice(0, 2), 16), parseInt(a.slice(2, 4), 16), parseInt(a.slice(4, 6), 16)).h, hue) }; })
    .sort((a, b) => a.gap - b.gap);
  const close = ranked.filter((x) => x.gap <= ranked[0].gap + 20);
  return close[Math.floor(Math.random() * close.length)].l;
}

/** A name the AI can letter: emoji, fancy unicode fonts and symbols removed; null when nothing usable is left. */
export function cleanWelcomeName(...names: (string | null | undefined)[]): string | null {
  for (const n of names) {
    if (!n) continue;
    const s = n
      .normalize("NFKC")
      .replace(/[\p{Extended_Pictographic}\p{Cf}\p{Cc}️]/gu, "")
      .replace(/[^\p{L}\p{N} ._'&!?-]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    const letters = s.replace(/[\s._'&!?-]/g, "");
    const latin = (letters.match(/[A-Za-z0-9]/g) ?? []).length;
    if (latin >= 2 && latin >= letters.length * 0.7 && !BLOCKED.test(s)) return s.slice(0, 22).trim();
  }
  return null;
}

/** The brief for one banner. */
export function welcomePrompt(name: string, look: Look, colours?: string[]): string {
  const spell = (t: string) => t.split(/\s+/).map((w) => (w.length >= 4 ? `${w} (${[...w].join("-")})` : w)).join(" ");
  return [
    `A premium Discord WELCOME BANNER (wide 2:1) for the KIXO GFX studio community — like the welcome graphic of a top esports / GFX design studio: a finished Photoshop composite with real lighting, depth and effects, never flat, never clip-art.`,
    `THE LOOK FOR THIS BANNER: ${look.scene}. The scene fills the WHOLE frame edge to edge, with depth: background → light streaks and particles → the lettering → foreground sparks slightly out of focus.`,
    ...(colours?.length ? [`COLOURS — made for this member: the banner's lights, glow, particles and the lettering's highlights follow their profile picture's colours: ${colours.join(" and ")} (keep the look above, tinted toward these colours, rich and bright, never muddy).`] : []),
    `LAYOUT (exact — the picture is finished by KIXO afterwards):`,
    `- LEFT ZONE — from 4% to 43% of the width, the full height: keep it calm — only the scene continuing there, a little darker, with a soft ROUND GLOW of light centred at 23% of the width and 45% of the height. NOTHING else in this zone: no text, no circle, no ring, no frame, no badge, no shield, no figure, no object — the member's round profile picture and the member number are placed there afterwards.`,
    `- TOP-RIGHT CORNER — the top 15% of the height over the right 24% of the width stays clean (only the scene): the KIXO logo is placed there afterwards.`,
    `- RIGHT SIDE — from 46% to 96% of the width, centred vertically, three lines stacked and centred on each other:`,
    `  1. a small letter-spaced line: "WELCOME TO KIXO"`,
    `  2. the member's name as the HERO — huge 3D lettering: "${name}" — ${look.letters}; one line if it fits (two at most), as big as the right side allows, perfectly kerned`,
    `  3. a small letter-spaced line: "CREATE • DESIGN • STAND OUT"`,
    `TEXT RULES: write ONLY those three texts, letter for letter, each once — spelling check: ${spell(name)}. Keep the name's exact letters and capitalisation style readable (it may be set in capitals). No other words, numbers, hashtags, watermarks or logos anywhere.`,
    `NO people, faces, bodies, hands, characters, mascots, animals or brand logos anywhere — the lettering and the scene are the whole design.`,
  ].join("\n");
}

const hexRgb = (c: string) => {
  const v = parseInt(c.replace("#", ""), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
};
const mix = (c: string, t: string, k: number) => {
  const a = hexRgb(c);
  const b = hexRgb(t);
  const f = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${f(a.r, b.r)}${f(a.g, b.g)}${f(a.b, b.b)}`;
};

/** The member's picture from Discord's CDN (nothing else is fetched). */
export async function fetchAvatar(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(u.hostname)) return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length && buf.length <= 6 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

/** KIXO's exact parts on top of the AI art: the picture in a glowing ring, the member number, the KIXO logo. */
export async function composeWelcome(art: Buffer, avatar: Buffer | null, memberNumber: number, accentIn: string, fx = "none"): Promise<Buffer> {
  const W = WELCOME_W;
  const H = WELCOME_H;
  const base = await sharp(art).resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();
  const accent = accentIn;
  const light = mix(accent, "#ffffff", 0.6);
  const dark = mix(accent, "#000000", 0.45);
  const cx = Math.round(W * AV.cx);
  const cy = Math.round(H * AV.cy);
  const R = Math.round((H * AV.d) / 2);
  const ring = Math.round(R * 0.085);
  // the ring: wide glow, metallic band in the accent, thin inner and outer highlights
  const ringSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.35" stop-color="${accent}"/><stop offset="0.55" stop-color="#ffffff"/><stop offset="0.75" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
<filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${Math.round(R * 0.09)}"/></filter>
<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${Math.round(R * 0.05)}"/></filter>
</defs>
<circle cx="${cx}" cy="${cy + Math.round(R * 0.05)}" r="${R + ring}" fill="#000000" fill-opacity="0.6" filter="url(#s)"/>
<circle cx="${cx}" cy="${cy}" r="${R + ring * 0.6}" fill="none" stroke="${accent}" stroke-opacity="0.85" stroke-width="${ring * 2.6}" filter="url(#g)"/>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="#0b0710"/>
<circle cx="${cx}" cy="${cy}" r="${R + ring / 2}" fill="none" stroke="url(#m)" stroke-width="${ring}"/>
<circle cx="${cx}" cy="${cy}" r="${R + ring}" fill="none" stroke="${light}" stroke-opacity="0.8" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="${R - 1}" fill="none" stroke="#000000" stroke-opacity="0.7" stroke-width="3"/>
</svg>`;
  const layers: { input: Buffer; left: number; top: number; blend?: "over" }[] = [];
  // The member's picture worked into the background (Admin → Settings picks how; KIXO blends the real picture).
  layers.push(...(await welcomeFxLayers(fx, { W, H, cx, cy, R, accent }, avatar, base)));
  layers.push({ input: await sharp(Buffer.from(ringSvg)).png().toBuffer(), left: 0, top: 0 });
  // the picture, cut to a circle (the KIXO logo on dark when the member has none)
  const size = R * 2 - 4;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  let pic: Buffer | null = null;
  if (avatar) {
    try {
      pic = await sharp(avatar).resize(size, size, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    } catch {
      pic = null;
    }
  }
  if (!pic) {
    const logo = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).resize(Math.round(size * 0.72)).png().toBuffer();
    const lm = await sharp(logo).metadata();
    pic = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 14, g: 9, b: 18, alpha: 1 } } })
      .composite([{ input: logo, left: Math.round((size - (lm.width ?? 0)) / 2), top: Math.round((size - (lm.height ?? 0)) / 2) }, { input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  }
  layers.push({ input: pic as Buffer, left: cx - size / 2, top: cy - size / 2 });
  // the member number plate under the ring
  const plateW = Math.round(R * 1.55);
  const plateH = Math.round(H * 0.075);
  const plateY = cy + R + ring + Math.round(H * 0.035);
  try {
    const mont = await googleFont("Montserrat", 800);
    const el = (
      <div style={{ display: "flex", width: plateW, height: plateH, alignItems: "center", justifyContent: "center", borderRadius: plateH / 2, border: `3px solid ${accent}`, background: "rgba(6,4,10,0.82)", boxShadow: `0 0 24px ${accent}` }}>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 800, fontSize: Math.round(plateH * 0.42), letterSpacing: 6, color: "#ffffff", textShadow: `0 0 12px ${accent}` }}>{`MEMBER #${Math.max(1, Math.round(memberNumber) || 1)}`}</div>
      </div>
    );
    const res = new ImageResponse(el, { width: plateW + 60, height: plateH + 60, fonts: [{ name: "Montserrat", data: mont, weight: 800, style: "normal" }] });
    // satori draws on a transparent canvas the size given; centre the plate in it
    const png = Buffer.from(await res.arrayBuffer());
    layers.push({ input: png, left: cx - Math.round((plateW + 60) / 2), top: plateY - 30 });
  } catch (e) {
    console.error("welcome member plate failed (banner kept without it)", e);
  }
  // the KIXO logo, top right
  try {
    const lw = Math.round(W * 0.17);
    const logo = await sharp(Buffer.from(BRAND_LOGO_PNG_BASE64, "base64")).resize(lw).png().toBuffer();
    const pad = 24;
    const shadow = await sharp(logo).ensureAlpha().modulate({ brightness: 0 }).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(10).png().toBuffer();
    const x = W - lw - Math.round(W * 0.035);
    const y = Math.round(H * 0.045);
    layers.push({ input: shadow, left: x - pad, top: y - pad + 4 }, { input: logo, left: x, top: y });
  } catch {
    /* the banner is fine without it */
  }
  return sharp(base).composite(layers).png().toBuffer();
}

export type WelcomeJob = { status: "PENDING" | "READY" | "FAILED"; url?: string; error?: string; at: number };
const jobKey = (id: string) => `welcomejob:${id}`;
export const saveWelcomeJob = (id: string, j: WelcomeJob) => db.setting.upsert({ where: { key: jobKey(id) }, create: { key: jobKey(id), value: JSON.stringify(j) }, update: { value: JSON.stringify(j) } });
export async function readWelcomeJob(id: string): Promise<WelcomeJob | null> {
  const row = await db.setting.findUnique({ where: { key: jobKey(id) } });
  try {
    return row ? (JSON.parse(row.value) as WelcomeJob) : null;
  } catch {
    return null;
  }
}

/** Makes one banner (in the background) and records the result for the bot to pick up. */
export async function runWelcomeJob(id: string, p: { discordId: string; name: string | null; number: number; avatarUrl?: string }) {
  try {
    const last = (await db.setting.findUnique({ where: { key: "welcome_ai_last_look" } }))?.value ?? "";
    // The member's picture decides the colours: measured here, never sent to the AI.
    const avatar = await fetchAvatar(p.avatarUrl);
    const col = await avatarColours(avatar);
    const look = lookForAvatar(col.hue, last);
    await db.setting.upsert({ where: { key: "welcome_ai_last_look" }, create: { key: "welcome_ai_last_look", value: look.key }, update: { value: look.key } });
    const name = p.name ?? "NEW MEMBER";
    const art = await generatePoster(welcomePrompt(name, look, col.hex), [], "medium", ["2048x1024", "1536x1024"], 230_000);
    const fx = (await db.setting.findUnique({ where: { key: "welcome_ai_fx" } }))?.value ?? "right";
    const png = await composeWelcome(art, avatar, p.number, col.hex[0] ?? look.accent, fx);
    const url = await saveFile("welcome", png, "image/png");
    await saveWelcomeJob(id, { status: "READY", url, at: Date.now() });
    await db.setting.upsert({ where: { key: `welcome_ai_member:${p.discordId}` }, create: { key: `welcome_ai_member:${p.discordId}`, value: JSON.stringify({ url, at: Date.now() }) }, update: { value: JSON.stringify({ url, at: Date.now() }) } });
  } catch (e) {
    await saveWelcomeJob(id, { status: "FAILED", error: String(e instanceof Error ? e.message : e).slice(0, 300), at: Date.now() }).catch(() => {});
  }
}
