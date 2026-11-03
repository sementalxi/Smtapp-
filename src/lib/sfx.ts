// Little UI sounds made with the Web Audio API (no sound files to download).
// Users can turn them off (saved in this browser). Call sfx("done") etc. from client components.
export type Sfx = "tap" | "select" | "send" | "message" | "done" | "success" | "error";

let ctx: AudioContext | null = null;
const KEY = "kixo_sound";

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundOn(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "on" : "off");
  } catch {}
  if (v) sfx("select");
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** One soft tone. */
function tone(c: AudioContext, freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = "sine", slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

/** Call on the first tap/click so later sounds (like a new support message) are allowed to play. */
export function unlockAudio() {
  const c = ac();
  if (!c) return;
  // A silent blip "unlocks" audio on iPhone/Safari.
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {}
}

export function sfx(kind: Sfx) {
  if (!soundOn()) return;
  const c = ac();
  if (!c) return;
  switch (kind) {
    case "tap": // crisp click (audible on phones and laptops)
      tone(c, 1800, 0, 0.045, 0.09, "triangle", 1100);
      tone(c, 900, 0.01, 0.05, 0.05, "sine", 600);
      break;
    case "select": // soft pop
      tone(c, 520, 0, 0.1, 0.1, "sine", 900);
      break;
    case "send": // whoosh up
      tone(c, 420, 0, 0.16, 0.06, "sine", 1100);
      break;
    case "message": // two-note ding
      tone(c, 880, 0, 0.18, 0.08, "sine");
      tone(c, 1320, 0.12, 0.28, 0.07, "sine");
      break;
    case "success": // happy three-note chime
      [659, 830, 988].forEach((f, i) => tone(c, f, i * 0.09, 0.3, 0.07, "sine"));
      break;
    case "done": // poster ready: little fanfare + sparkle
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.1, 0.35, 0.08, "triangle"));
      [1568, 2093, 2637].forEach((f, i) => tone(c, f, 0.45 + i * 0.06, 0.25, 0.03, "sine"));
      break;
    case "error": // low double buzz
      tone(c, 220, 0, 0.14, 0.07, "square", 180);
      tone(c, 196, 0.16, 0.2, 0.07, "square", 150);
      break;
  }
}
