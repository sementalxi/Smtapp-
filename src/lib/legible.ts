// Keeps a style's accent colour readable as TEXT on KIXO's dark table panels (standings, qualifiers, showcase):
// a dark accent (navy, deep brown, near-black — common when a style's colours were read from a reference
// picture or a crest) is lifted to a light tint of the SAME hue, so position numbers, points and legends never
// vanish into the panel. Anything that is not a colour falls back to KIXO gold.
export function legibleAccent(c: string | null | undefined, fallback = "#ffc83d"): string {
  const m = (c ?? "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  const h6 = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  const v = parseInt(h6, 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const lin = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  if (lum >= 0.12) return `#${h6.toLowerCase()}`;
  // Too dark for text: same hue and saturation, lifted to a readable lightness.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  const grey = s < 0.15;
  const nl = grey ? 0.86 : 0.62;
  const ns = grey ? s : Math.max(s, 0.55);
  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns;
  const p = 2 * nl - q;
  const ch = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  return `#${to(ch(hue + 1 / 3))}${to(ch(hue))}${to(ch(hue - 1 / 3))}`;
}
