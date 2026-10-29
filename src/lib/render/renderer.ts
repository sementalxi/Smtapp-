// Canvas banner renderer. Pure browser code, no React — runs in the editor,
// the template previews, and (via a headless browser) in tests.

import {
  BannerInputs,
  CANVAS_H,
  CANVAS_W,
  DesignState,
  FontKey,
  LayoutKind,
  TemplateStyle,
} from "../templates";

export type Img = CanvasImageSource & { width: number; height: number };

export interface RenderAssets {
  background?: Img | null;
  cutout?: Img | null; // transparent PNG of the player/mascot
  logo?: Img | null;
}

export interface RenderOptions {
  layout: LayoutKind;
  style: TemplateStyle;
  inputs: BannerInputs;
  design: DesignState;
  assets: RenderAssets;
  /** CSS font-family strings for each font key (from next/font). */
  fonts: Record<FontKey, string>;
  brand: string;
  /** Faint repeated watermark (for previews / free tier) */
  watermark?: string;
}

const W = CANVAS_W;
const H = CANVAS_H;
type Ctx = CanvasRenderingContext2D;

// ─── Utilities ────────────────────────────────────────────

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function font(ctx: Ctx, family: string, size: number, weight = "400") {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
}

/** Largest font size (≤ max) at which `text` fits in maxWidth. */
function fitSize(ctx: Ctx, text: string, family: string, maxWidth: number, max: number, min = 12, spacing = 0) {
  let size = max;
  while (size > min) {
    font(ctx, family, size);
    const w = ctx.measureText(text).width + spacing * size * Math.max(0, text.length - 1);
    if (w <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/** Draws text with manual letter spacing (em units). */
function spacedText(ctx: Ctx, text: string, x: number, y: number, spacingEm: number, align: "left" | "center" | "right") {
  const size = parseFloat(ctx.font.split("px")[0].split(" ").pop() || "16");
  const gap = spacingEm * size;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + gap;
  });
  ctx.textAlign = prev;
  return total;
}

function verticalGradient(ctx: Ctx, y0: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  return g;
}

function coverRect(img: Img, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

/** Bounding box of non-transparent pixels, so we can place the subject precisely. */
const bboxCache = new WeakMap<object, { x: number; y: number; w: number; h: number }>();
function opaqueBox(img: Img) {
  const cached = bboxCache.get(img as object);
  if (cached) return cached;
  const scale = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = makeCanvas(img.width * scale, img.height * scale);
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0, c.width, c.height);
  let box = { x: 0, y: 0, w: img.width, h: img.height };
  try {
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width,
      minY = c.height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= 0) {
      box = {
        x: minX / scale,
        y: minY / scale,
        w: (maxX - minX + 1) / scale,
        h: (maxY - minY + 1) / scale,
      };
    }
  } catch {
    /* tainted canvas (missing CORS) → use the full image */
  }
  bboxCache.set(img as object, box);
  return box;
}

/** Monochrome, color-tinted copy of an image (for the ghost portrait). */
function tinted(img: Img, color: string, w: number, h: number) {
  const c = makeCanvas(w, h);
  const cx = c.getContext("2d")!;
  cx.drawImage(img, 0, 0, w, h);
  try {
    const data = cx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      // luminance with a contrast boost
      let l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      l = Math.min(255, Math.max(0, (l - 128) * 1.35 + 128));
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    cx.putImageData(data, 0, 0);
  } catch {
    /* ignore (tainted) */
  }
  cx.globalCompositeOperation = "source-atop";
  cx.fillStyle = rgba(color, 0.35);
  cx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Fades the bottom `fraction` of a canvas to transparent. */
function fadeBottom(c: HTMLCanvasElement, fraction: number) {
  const cx = c.getContext("2d")!;
  cx.globalCompositeOperation = "destination-out";
  const g = cx.createLinearGradient(0, c.height * (1 - fraction), 0, c.height);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, c.width, c.height);
  cx.globalCompositeOperation = "source-over";
}

// ─── Shared layers ────────────────────────────────────────

function drawBackground(ctx: Ctx, o: RenderOptions, r: () => number) {
  const { style, assets } = o;
  if (assets.background) {
    const rc = coverRect(assets.background, W, H);
    ctx.drawImage(assets.background, rc.x, rc.y, rc.w, rc.h);
  } else {
    // Procedural fallback so the template still looks good without AI
    const [c0, c1, c2] = style.fallback;
    const g = ctx.createRadialGradient(W * 0.6, H * 0.35, 40, W * 0.5, H * 0.5, H * 0.85);
    g.addColorStop(0, c2);
    g.addColorStop(0.45, c1);
    g.addColorStop(1, c0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // angular shards
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = r() * H;
      const s = 40 + r() * 220;
      const a = r() * Math.PI * 2;
      ctx.beginPath();
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++) {
        const ang = a + k * ((Math.PI * 2) / 4) + r() * 0.8;
        const rad = s * (0.4 + r() * 0.8);
        const px = x + Math.cos(ang) * rad;
        const py = y + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const sg = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
      sg.addColorStop(0, rgba(style.accent, 0.0));
      sg.addColorStop(0.5, rgba(style.accent, 0.12 + r() * 0.16));
      sg.addColorStop(1, rgba(style.primary, 0.02));
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = rgba(style.accent, 0.18);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
    // stadium-light bokeh
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const x = r() * W;
      const y = r() * H * 0.45;
      const rad = 4 + r() * 18;
      const bg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      bg.addColorStop(0, "rgba(255,255,255,0.55)");
      bg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }
}

function colorGrade(ctx: Ctx, o: RenderOptions) {
  const { style, design } = o;
  const k = design.overlay;
  // tint
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = rgba(style.primary, 0.9 * k);
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = rgba(style.primary, 0.25 * k);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, rgba(style.dark, 0.75 * (0.5 + k / 2)));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // bottom fade for text legibility
  const b = ctx.createLinearGradient(0, H * 0.55, 0, H);
  b.addColorStop(0, rgba(style.dark, 0));
  b.addColorStop(1, rgba(style.dark, 0.92));
  ctx.fillStyle = b;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
}

function lightStreaks(ctx: Ctx, o: RenderOptions, r: () => number) {
  if (!o.style.streaks) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(r() * W, r() * H);
    ctx.rotate(-0.7 + r() * 0.15);
    const len = 900 + r() * 700;
    const th = 6 + r() * 40;
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, rgba(o.style.accent, 0));
    g.addColorStop(0.5, rgba(o.style.accent, 0.22 + r() * 0.2));
    g.addColorStop(1, rgba(o.style.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, -th / 2, len, th);
    ctx.restore();
  }
  ctx.restore();
}

function giantText(ctx: Ctx, o: RenderOptions, text: string) {
  if (!o.style.giantText || !text) return;
  const t = text.toUpperCase();
  ctx.save();
  const fam = o.fonts[o.style.scriptFont === "gothic" ? "gothic" : "anton"];
  const size = fitSize(ctx, t, fam, W * 1.6, 620, 200);
  font(ctx, fam, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(W / 2, H * 0.42);
  ctx.rotate(-0.06);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = o.style.accent;
  ctx.fillText(t, 0, 0);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(t, 0, 0);
  ctx.restore();
}

function particles(ctx: Ctx, o: RenderOptions, r: () => number) {
  if (!o.design.particles || o.style.particles === "none") return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const kind = o.style.particles;
  const n = kind === "snow" ? 140 : 110;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const s = kind === "snow" ? 1 + r() * 3.5 : 1 + r() * 2.5;
    const a = 0.25 + r() * 0.7;
    if (kind === "embers" || kind === "sparks") {
      const len = kind === "embers" ? 6 + r() * 26 : 3 + r() * 10;
      const ang = kind === "embers" ? -Math.PI / 2 + (r() - 0.5) * 0.9 : r() * Math.PI * 2;
      ctx.strokeStyle = kind === "embers" ? `rgba(255,${120 + Math.floor(r() * 110)},60,${a})` : rgba(o.style.accent, a);
      ctx.lineWidth = s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // a few bright flares
  for (let i = 0; i < 5; i++) {
    const x = r() * W;
    const y = r() * H * 0.8;
    const rad = 30 + r() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.7)");
    g.addColorStop(0.15, rgba(o.style.accent, 0.35));
    g.addColorStop(1, rgba(o.style.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

/** Places the subject so its visible pixels fill a target box. */
function subjectRect(img: Img, target: { cx: number; bottom: number; h: number }, scale: number) {
  const box = opaqueBox(img);
  const s = (target.h * scale) / box.h;
  const w = img.width * s;
  const h = img.height * s;
  // align horizontal center of opaque box with cx, its bottom with target bottom
  const x = target.cx - (box.x + box.w / 2) * s;
  const y = target.bottom - (box.y + box.h) * s;
  return { x, y, w, h, s, box };
}

function drawGhost(ctx: Ctx, o: RenderOptions, cutout: Img, cx: number) {
  if (!o.style.ghost || !o.design.ghost) return;
  const box = opaqueBox(cutout);
  // Head-and-shoulders crop: top ~45% of the subject, drawn big.
  const cropH = box.h * 0.45;
  const targetH = H * 0.78;
  const s = targetH / cropH;
  const w = box.w * s;
  const off = makeCanvas(w, targetH);
  const oc = off.getContext("2d")!;
  oc.drawImage(cutout, box.x, box.y, box.w, cropH, 0, 0, w, targetH);
  const t = tinted(off, o.style.primary, off.width, off.height);
  fadeBottom(t, 0.45);
  ctx.save();
  ctx.globalAlpha = o.design.ghostOpacity;
  ctx.drawImage(t, cx - w / 2 + W * 0.08, H * 0.02);
  ctx.restore();
}

function drawSubject(ctx: Ctx, o: RenderOptions, img: Img, target: { cx: number; bottom: number; h: number }) {
  const rc = subjectRect(img, target, o.design.playerScale);
  const off = makeCanvas(rc.w, rc.h);
  off.getContext("2d")!.drawImage(img, 0, 0, rc.w, rc.h);
  // fade the cut-off bottom edge only when the subject runs off the canvas
  if (rc.y + rc.h > H - 40) fadeBottom(off, 0.12);

  ctx.save();
  // rim glow
  ctx.shadowColor = rgba(o.style.accent, 0.85);
  ctx.shadowBlur = 45;
  ctx.drawImage(off, rc.x, rc.y);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(off, rc.x, rc.y);
  ctx.restore();
  // subtle color match
  ctx.save();
  const m = makeCanvas(rc.w, rc.h);
  const mc = m.getContext("2d")!;
  mc.drawImage(off, 0, 0);
  mc.globalCompositeOperation = "source-atop";
  const g = mc.createLinearGradient(0, 0, rc.w, 0);
  g.addColorStop(0, rgba(o.style.primary, 0.18));
  g.addColorStop(1, rgba(o.style.accent, 0.08));
  mc.fillStyle = g;
  mc.fillRect(0, 0, rc.w, rc.h);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(m, rc.x, rc.y);
  ctx.restore();
  return rc;
}

function drawLogo(ctx: Ctx, o: RenderOptions, cx: number, cy: number, size: number) {
  const logo = o.assets.logo;
  if (!logo) return;
  const s = (size * o.design.logoScale) / Math.max(logo.width, logo.height);
  const w = logo.width * s;
  const h = logo.height * s;
  ctx.save();
  ctx.shadowColor = rgba(o.style.accent, 0.9);
  ctx.shadowBlur = 35;
  ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function metalText(ctx: Ctx, o: RenderOptions, text: string, x: number, y: number, size: number, family: string, stops = o.style.nameGradient) {
  font(ctx, family, size);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  // drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = verticalGradient(ctx, y - size * 0.85, y, stops);
  ctx.fillText(text, x, y);
  ctx.restore();
  // fine outline + top highlight
  ctx.save();
  ctx.lineWidth = Math.max(1.5, size / 70);
  ctx.strokeStyle = rgba(o.style.dark, 0.55);
  ctx.strokeText(text, x, y);
  ctx.restore();
}

function footerBar(ctx: Ctx, o: RenderOptions, text: string) {
  const y = H - 54;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  font(ctx, o.fonts.sans, 22, "700");
  ctx.textBaseline = "middle";
  if (text) spacedText(ctx, text.toUpperCase(), W / 2, y, 0.55, "center");
  font(ctx, o.fonts.anton, 26);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const left = (o.inputs.number ? `#${o.inputs.number}` : new Date().getFullYear().toString()).toUpperCase();
  ctx.fillText(left, 70, y);
  ctx.textAlign = "right";
  font(ctx, o.fonts.anton, 24);
  ctx.fillText(o.brand.toUpperCase(), W - 70, y);
  ctx.restore();
}

function cornerMarks(ctx: Ctx, o: RenderOptions) {
  ctx.save();
  ctx.strokeStyle = rgba(o.style.accent, 0.7);
  ctx.lineWidth = 3;
  const m = 34;
  const l = 60;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * l);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * l, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  font(ctx, o.fonts.sans, 18, "700");
  ctx.textBaseline = "middle";
  spacedText(ctx, "× × × ×", m + 90, m + 6, 0.2, "left");
  ctx.restore();
}

function watermark(ctx: Ctx, o: RenderOptions) {
  if (!o.watermark) return;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#fff";
  font(ctx, o.fonts.anton, 54);
  ctx.textAlign = "center";
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.5);
  for (let y = -H; y < H; y += 190) {
    for (let x = -W; x < W; x += 520) ctx.fillText(o.watermark.toUpperCase(), x, y);
  }
  ctx.restore();
}

// ─── Layouts ──────────────────────────────────────────────

function layoutPlayer(ctx: Ctx, o: RenderOptions, r: () => number) {
  const { inputs: inp, design, fonts, style } = o;
  giantText(ctx, o, inp.team || inp.name);
  lightStreaks(ctx, o, r);

  const playerCx = W * (0.6 + design.playerX);
  if (o.assets.cutout) drawGhost(ctx, o, o.assets.cutout, playerCx);
  particles(ctx, o, r);
  if (o.assets.cutout) {
    drawSubject(ctx, o, o.assets.cutout, { cx: playerCx, bottom: H * (1.02 + design.playerY), h: H * 0.72 });
  }

  // Logo top-left area
  drawLogo(ctx, o, W * 0.24, H * 0.5, 250);

  // Text block bottom-left
  const left = 70;
  const nameFam = fonts[style.nameFont];
  let y = H * 0.66;

  if (inp.tagline) {
    ctx.save();
    font(ctx, fonts.gothic, 64);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(inp.tagline, left, y);
    ctx.restore();
    y += 18;
  }

  if (inp.position) {
    const label = inp.position.toUpperCase();
    font(ctx, fonts.sans, 40, "800");
    const tw = spacedWidth(ctx, label, 0.08);
    ctx.save();
    ctx.fillStyle = style.primary;
    ctx.shadowColor = rgba(style.accent, 0.8);
    ctx.shadowBlur = 20;
    ctx.fillRect(left, y + 6, tw + 44, 62);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    spacedText(ctx, label, left + 22, y + 39, 0.08, "left");
    ctx.textBaseline = "alphabetic";
    y += 82;
  }

  const name = (inp.name || "PLAYER").toUpperCase();
  const maxSize = 230 * design.nameScale;
  const size = fitSize(ctx, name, nameFam, W * 0.62, maxSize, 60);
  y += size * 0.86;
  ctx.textAlign = "left";
  metalText(ctx, o, name, left, y, size, nameFam);

  if (inp.subtitle) {
    const fam = style.scriptFont === "sans" ? fonts.anton : fonts[style.scriptFont];
    const s2 = fitSize(ctx, inp.subtitle, fam, W * 0.55, 76, 30);
    ctx.save();
    ctx.translate(left + 8, y + s2 * 0.95);
    ctx.rotate(-0.04);
    font(ctx, fam, s2);
    ctx.fillStyle = style.accent;
    ctx.shadowColor = rgba(style.dark, 0.9);
    ctx.shadowBlur = 10;
    ctx.fillText(inp.subtitle, 0, 0);
    ctx.restore();
    y += s2 * 1.1;
  }

  if (inp.team) {
    ctx.save();
    font(ctx, fonts.sans, 26, "800");
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(left, y + 18, 6, 34);
    ctx.textBaseline = "middle";
    spacedText(ctx, inp.team.toUpperCase(), left + 20, y + 36, 0.3, "left");
    ctx.restore();
  }

  // Big outlined number on the right edge
  if (inp.number) {
    ctx.save();
    font(ctx, fonts.anton, 300);
    ctx.textAlign = "right";
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(style.accent, 0.55);
    ctx.strokeText(inp.number, W - 60, H * 0.36);
    ctx.restore();
  }

  cornerMarks(ctx, o);
  footerBar(ctx, o, inp.footer || inp.team);
}

function spacedWidth(ctx: Ctx, text: string, em: number) {
  const size = parseFloat(ctx.font.split("px")[0].split(" ").pop() || "16");
  return ctx.measureText(text).width + em * size * Math.max(0, [...text].length - 1);
}

function wrapRoster(ctx: Ctx, names: string[], maxWidth: number) {
  const lines: string[] = [];
  let cur = "";
  for (const n of names.map((s) => s.trim()).filter(Boolean)) {
    const next = cur ? `${cur}  |  ${n}` : n;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = n;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function layoutChampions(ctx: Ctx, o: RenderOptions, r: () => number) {
  const { inputs: inp, fonts, style, design } = o;
  lightStreaks(ctx, o, r);

  // Event line
  if (inp.eventName) {
    ctx.save();
    font(ctx, fonts.sans, 34, "800");
    ctx.fillStyle = verticalGradient(ctx, 70, 120, [style.accent, style.primary]);
    ctx.textBaseline = "middle";
    spacedText(ctx, inp.eventName.toUpperCase(), W / 2, 112, 0.25, "center");
    ctx.restore();
  }

  // Huge headline
  const head = (inp.headline || "CHAMPIONS").toUpperCase();
  const hs = fitSize(ctx, head, fonts[style.nameFont], W - 120, 260 * design.nameScale, 80);
  ctx.textAlign = "center";
  metalText(ctx, o, head, W / 2, 140 + hs * 0.88, hs, fonts[style.nameFont]);

  particles(ctx, o, r);

  // Crest / mascot in the middle
  const midY = H * 0.6;
  if (o.assets.cutout) {
    drawSubject(ctx, o, o.assets.cutout, { cx: W * (0.5 + design.playerX), bottom: midY + H * (0.12 + design.playerY), h: H * 0.42 });
  } else if (o.assets.logo) {
    drawLogo(ctx, o, W / 2, midY - 40, 420);
  }
  // small logo top-center if both exist
  if (o.assets.cutout && o.assets.logo) drawLogo(ctx, o, W - 150, 380, 170);

  // Team name
  const team = (inp.team || "TEAM").toUpperCase();
  const ts = fitSize(ctx, team, fonts.anton, W - 160, 170, 60);
  ctx.textAlign = "center";
  metalText(ctx, o, team, W / 2, H * 0.79, ts, fonts.anton, ["#ffffff", "#dcdcdc", "#8a8a8a"]);

  // Roster
  if (inp.roster.length) {
    ctx.save();
    font(ctx, fonts.sans, 30, "800");
    const lines = wrapRoster(ctx, inp.roster, W - 140).slice(0, 4);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,.8)";
    ctx.shadowBlur = 8;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.83 + i * 42));
    ctx.restore();
  }

  // Prize badge
  if (inp.prize) {
    ctx.save();
    const ps = fitSize(ctx, inp.prize.toUpperCase(), fonts.anton, 380, 92, 40);
    ctx.textAlign = "right";
    ctx.translate(0, 0);
    metalText(ctx, o, inp.prize.toUpperCase(), W - 60, H - 100, ps, fonts.anton, ["#fff7d1", "#f5c74e", "#b07514"]);
    ctx.restore();
  }

  cornerMarks(ctx, o);
  footerBar(ctx, o, inp.footer);
}

function layoutEvent(ctx: Ctx, o: RenderOptions, r: () => number) {
  const { inputs: inp, fonts, style, design } = o;
  giantText(ctx, o, inp.name || inp.headline);
  lightStreaks(ctx, o, r);
  particles(ctx, o, r);
  if (o.assets.cutout) {
    drawSubject(ctx, o, o.assets.cutout, { cx: W * (0.5 + design.playerX), bottom: H * (1.02 + design.playerY), h: H * 0.78 });
  }
  drawLogo(ctx, o, 150, 170, 150);

  ctx.textAlign = "center";
  const head = (inp.headline || "$100").toUpperCase();
  const hs = fitSize(ctx, head, fonts.anton, W - 200, 250 * design.nameScale, 80);
  const headY = H * 0.6 + hs * 0.5;
  metalText(ctx, o, head, W / 2, headY, hs, fonts.anton, ["#ffffff", "#fff0c4", style.accent, "#9c6410"]);

  const title = (inp.name || "TOURNAMENT").toUpperCase();
  const ts = fitSize(ctx, title, fonts[style.nameFont], W - 100, 170, 50);
  metalText(ctx, o, title, W / 2, headY + ts * 0.95, ts, fonts[style.nameFont], ["#ffffff", "#e9e9e9", "#a9a9a9"]);
  let y = headY + ts * 0.95;

  if (inp.subtitle) {
    const fam = style.scriptFont === "sans" ? fonts.anton : fonts[style.scriptFont];
    const ss = fitSize(ctx, inp.subtitle, fam, W * 0.7, 110, 40);
    ctx.save();
    font(ctx, fam, ss);
    ctx.fillStyle = style.primary;
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.6)";
    ctx.strokeText(inp.subtitle, W / 2, y + ss * 0.7);
    ctx.fillText(inp.subtitle, W / 2, y + ss * 0.7);
    ctx.restore();
    y += ss * 0.8;
  }

  const info = [inp.date, inp.details].filter(Boolean).join("   ·   ").toUpperCase();
  if (info) {
    ctx.save();
    font(ctx, fonts.sans, 28, "800");
    const tw = spacedWidth(ctx, info, 0.12) + 60;
    ctx.fillStyle = rgba(style.dark, 0.75);
    ctx.strokeStyle = rgba(style.accent, 0.8);
    ctx.lineWidth = 2;
    const bx = W / 2 - tw / 2;
    const by = Math.min(y + 30, H - 160);
    roundRect(ctx, bx, by, tw, 58, 29);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    spacedText(ctx, info, W / 2, by + 30, 0.12, "center");
    ctx.restore();
  }

  if (inp.prize) {
    ctx.save();
    ctx.textAlign = "right";
    const ps = fitSize(ctx, inp.prize.toUpperCase(), fonts.anton, 340, 80, 36);
    metalText(ctx, o, inp.prize.toUpperCase(), W - 60, 200, ps, fonts.anton, ["#fff7d1", "#f5c74e", "#b07514"]);
    ctx.restore();
  }

  cornerMarks(ctx, o);
  footerBar(ctx, o, inp.footer);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// ─── Entry point ──────────────────────────────────────────

export function renderBanner(canvas: HTMLCanvasElement, o: RenderOptions) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const r = rng(o.design.seed);

  drawBackground(ctx, o, r);
  colorGrade(ctx, o);

  if (o.layout === "CHAMPIONS") layoutChampions(ctx, o, r);
  else if (o.layout === "EVENT") layoutEvent(ctx, o, r);
  else layoutPlayer(ctx, o, r);

  watermark(ctx, o);
}

/** Loads an image with CORS enabled (needed to export the canvas). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}
