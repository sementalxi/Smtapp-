"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

/**
 * Turns a finished poster into a short vertical video (9:16) for TikTok, Reels and
 * Stories — free, made in the browser: zoom, light sweeps, sparks, flash intro, glitch.
 */

const W = 720;
const H = 1280;
const FPS = 30;

type FxKey = "zoom" | "shine" | "sparks" | "flash" | "glitch" | "pulse";
const PRESETS: { id: string; icon: string; en: string; es: string; fx: FxKey[]; color: string }[] = [
  { id: "hype", icon: "⚡", en: "Hype", es: "Hype", fx: ["flash", "zoom", "shine", "sparks", "glitch"], color: "#ffffff" },
  { id: "fire", icon: "🔥", en: "Fire", es: "Fuego", fx: ["flash", "zoom", "sparks", "pulse"], color: "#ff8a2a" },
  { id: "smooth", icon: "✨", en: "Smooth", es: "Suave", fx: ["zoom", "shine", "pulse"], color: "#3ee0ff" },
  { id: "gold", icon: "🏆", en: "Gold", es: "Oro", fx: ["flash", "zoom", "shine", "sparks"], color: "#ffd35a" },
  { id: "clean", icon: "🎯", en: "Clean", es: "Limpio", fx: ["zoom"], color: "#ffffff" },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  seed: number;
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load failed"));
    img.src = src;
  });
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export function MotionStudio({ src, baseName, onClose }: { src: string; baseName: string; onClose: () => void }) {
  const { locale } = useT();
  const es = locale === "es";
  const canvas = useRef<HTMLCanvasElement>(null);
  const assets = useRef<{ img: HTMLImageElement; bg: HTMLCanvasElement } | null>(null);
  const particles = useRef<Particle[]>([]);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [duration, setDuration] = useState(6);
  const [ready, setReady] = useState(false);
  const [rec, setRec] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [err, setErr] = useState("");
  const startRef = useRef(0);
  const recording = useRef(false);

  // Load the poster and a blurred background copy once.
  useEffect(() => {
    let alive = true;
    loadImg(src)
      .then((img) => {
        if (!alive) return;
        const bg = document.createElement("canvas");
        bg.width = Math.round(W / 20);
        bg.height = Math.round(H / 20);
        const b = bg.getContext("2d")!;
        const cover = Math.max(bg.width / img.width, bg.height / img.height);
        b.drawImage(img, (bg.width - img.width * cover) / 2, (bg.height - img.height * cover) / 2, img.width * cover, img.height * cover);
        assets.current = { img, bg };
        setReady(true);
      })
      .catch(() => setErr(es ? "No se pudo cargar la imagen." : "Couldn't load the image."));
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      document.body.style.overflow = "";
    };
  }, [src, es]);

  const draw = useCallback(
    (t: number, ctx: CanvasRenderingContext2D) => {
      const a = assets.current;
      if (!a) return;
      const fx = new Set(preset.fx);
      const dur = duration;
      const p = t / dur;

      // Background: blurred, darkened, slowly drifting.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const drift = Math.sin(t * 0.6) * 18;
      ctx.drawImage(a.bg, -W * 0.08 + drift, -H * 0.08, W * 1.16, H * 1.16);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, W, H);

      // Pulse: coloured glow behind the poster.
      if (fx.has("pulse")) {
        const pulse = 0.35 + 0.25 * Math.sin(t * 3.2);
        const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.95);
        g.addColorStop(0, `${preset.color}${Math.round(pulse * 255).toString(16).padStart(2, "0")}`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Poster transform: flash punch-in + slow zoom + tiny float.
      const pw = W * 0.92;
      const ph = (pw * a.img.height) / a.img.width;
      let scale = fx.has("zoom") ? 1 + 0.09 * ease(p) : 1;
      let shakeX = 0;
      let shakeY = Math.sin(t * 1.4) * 4;
      if (fx.has("flash") && t < 0.7) {
        const k = ease(t / 0.7);
        scale *= 1.18 - 0.18 * k;
        shakeX = (Math.random() - 0.5) * 14 * (1 - k);
        shakeY += (Math.random() - 0.5) * 14 * (1 - k);
      }
      const cx = W / 2 + shakeX;
      const cy = H / 2 + shakeY;
      const dw = pw * scale;
      const dh = ph * scale;
      const x = cx - dw / 2;
      const y = cy - dh / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 50;
      ctx.drawImage(a.img, x, y, dw, dh);
      ctx.restore();

      // Glitch: short RGB-split slices at two moments.
      if (fx.has("glitch")) {
        const hits = [0.9, dur * 0.55];
        for (const h of hits) {
          if (t > h && t < h + 0.18) {
            for (let i = 0; i < 7; i++) {
              const sy = y + Math.random() * dh;
              const sh = 8 + Math.random() * 40;
              const off = (Math.random() - 0.5) * 50;
              const srcY = ((sy - y) / dh) * a.img.height;
              const srcH = (sh / dh) * a.img.height;
              ctx.globalAlpha = 0.85;
              ctx.drawImage(a.img, 0, srcY, a.img.width, srcH, x + off, sy, dw, sh);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(255,0,80,0.12)";
            ctx.fillRect(x - 6, y, dw, dh);
            ctx.fillStyle = "rgba(0,200,255,0.12)";
            ctx.fillRect(x + 6, y, dw, dh);
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }

      // Shine: a diagonal light band sweeping across the poster.
      if (fx.has("shine")) {
        const sweeps = [1.1, dur * 0.65];
        for (const s0 of sweeps) {
          const k = (t - s0) / 0.9;
          if (k > 0 && k < 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, dw, dh);
            ctx.clip();
            const bx = x - dw * 0.6 + (dw * 2.2) * ease(k);
            const g = ctx.createLinearGradient(bx - 120, y, bx + 120, y + 160);
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(0.5, "rgba(255,255,255,0.45)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = g;
            ctx.translate(bx, y + dh / 2);
            ctx.rotate(-0.35);
            ctx.translate(-bx, -(y + dh / 2));
            ctx.fillRect(bx - 160, y - dh, 320, dh * 3);
            ctx.restore();
          }
        }
      }

      // Sparks / embers rising.
      if (fx.has("sparks")) {
        const ps = particles.current;
        if (ps.length < 70 && Math.random() < 0.9) {
          ps.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 40, vy: -(80 + Math.random() * 220), r: 1 + Math.random() * 3.2, life: 0, seed: Math.random() * 10 });
        }
        ctx.globalCompositeOperation = "lighter";
        for (let i = ps.length - 1; i >= 0; i--) {
          const q = ps[i];
          q.life += 1 / FPS;
          q.x += (q.vx + Math.sin(t * 2 + q.seed) * 20) / FPS;
          q.y += q.vy / FPS;
          if (q.y < -20 || q.life > 6) {
            ps.splice(i, 1);
            continue;
          }
          const alpha = Math.max(0, 1 - q.life / 5);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 4);
          g.addColorStop(0, `rgba(255,255,255,${alpha})`);
          g.addColorStop(0.35, `${preset.color}${Math.round(alpha * 200).toString(16).padStart(2, "0")}`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.fillRect(q.x - q.r * 4, q.y - q.r * 4, q.r * 8, q.r * 8);
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // Flash: white burst at the start.
      if (fx.has("flash") && t < 0.45) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - t / 0.45)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Fade out the last 0.4 s so loops feel smooth.
      if (t > dur - 0.4) {
        ctx.fillStyle = `rgba(0,0,0,${(t - (dur - 0.4)) / 0.4 * 0.85})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
    [preset, duration],
  );

  // Live preview loop (also what gets recorded).
  useEffect(() => {
    if (!ready) return;
    const ctx = canvas.current!.getContext("2d")!;
    let raf = 0;
    startRef.current = performance.now();
    particles.current = [];
    const loop = () => {
      let t = (performance.now() - startRef.current) / 1000;
      if (t >= duration) {
        if (recording.current) {
          t = duration;
        } else {
          startRef.current = performance.now();
          particles.current = [];
          t = 0;
        }
      }
      draw(t, ctx);
      if (recording.current) setProgress(Math.min(1, t / duration));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, draw, duration]);

  async function record() {
    setErr("");
    const mime = pickMime();
    const c = canvas.current as (HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }) | null;
    if (!c?.captureStream || !mime) {
      setErr(es ? "Tu navegador no puede grabar video. Prueba con Chrome o Safari actualizado." : "Your browser can't record video. Try an up-to-date Chrome or Safari.");
      return;
    }
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl("");
    setRec("recording");
    setProgress(0);
    const stream = c.captureStream(FPS);
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      recording.current = false;
      stream.getTracks().forEach((tr) => tr.stop());
      const type = mime.split(";")[0];
      const ext = type === "video/mp4" ? "mp4" : "webm";
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        setRec("error");
        setErr(es ? "La grabación salió vacía, intenta otra vez." : "The recording came out empty, try again.");
        return;
      }
      const f = new File([blob], `${baseName.replace(/[^\w-]+/g, "-").toLowerCase() || "kixo"}-motion.${ext}`, { type });
      setFile(f);
      setFileUrl(URL.createObjectURL(blob));
      setRec("done");
    };
    // Restart the animation from 0 and record exactly one run.
    particles.current = [];
    startRef.current = performance.now();
    recording.current = true;
    mr.start(250);
    setTimeout(() => mr.state !== "inactive" && mr.stop(), duration * 1000 + 150);
  }

  async function share() {
    if (!file) return;
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "KIXO" });
        return;
      } catch {
        /* cancelled — fall back to download */
      }
    }
    download();
  }

  function download() {
    if (!file || !fileUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = file.name;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 sm:items-center sm:p-4" onClick={rec === "recording" ? undefined : onClose}>
      <div className="card flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-b-none sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="font-bold">🎬 {es ? "Dale vida a tu póster" : "Make it come alive"}</div>
            <div className="text-xs text-muted">{es ? "Video 9:16 para TikTok, Reels e Historias — gratis" : "9:16 video for TikTok, Reels and Stories — free"}</div>
          </div>
          <button type="button" className="btn-ghost px-3 py-1.5" disabled={rec === "recording"} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,300px)_1fr]">
          <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border border-line bg-ink">
            <canvas ref={canvas} width={W} height={H} className="block aspect-[9/16] w-full" />
            {!ready && !err && <div className="absolute inset-0 grid place-items-center text-sm text-muted">…</div>}
            {rec === "recording" && (
              <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
                <div className="h-full bg-danger transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {rec === "recording" && <span className="chip absolute top-3 left-3 border-danger bg-danger/80 text-white">● REC</span>}
          </div>

          <div className="space-y-4">
            <div>
              <span className="label">{es ? "Estilo de movimiento" : "Motion style"}</span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-3">
                {PRESETS.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    disabled={rec === "recording"}
                    onClick={() => setPreset(pr)}
                    className={`rounded-lg border px-2 py-2.5 text-sm font-bold ${preset.id === pr.id ? "border-lime bg-lime/10 text-lime" : "border-line bg-panel-2"}`}
                  >
                    {pr.icon} {es ? pr.es : pr.en}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">{es ? "Duración" : "Length"}</span>
              <div className="flex gap-2">
                {[6, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={rec === "recording"}
                    onClick={() => setDuration(d)}
                    className={`flex-1 rounded-lg border py-2 text-sm font-bold ${duration === d ? "border-lime bg-lime/10 text-lime" : "border-line bg-panel-2"}`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {rec === "done" && fileUrl ? (
              <div className="space-y-2">
                <p className="text-sm text-lime">✅ {es ? "¡Video listo!" : "Video ready!"}</p>
                <button type="button" className="btn-primary w-full py-3" onClick={share}>
                  📲 {es ? "Compartir / Guardar" : "Share / Save"}
                </button>
                <button type="button" className="btn-ghost w-full" onClick={download}>
                  ⬇ {es ? "Descargar" : "Download"} ({file?.name.split(".").pop()?.toUpperCase()})
                </button>
                <button type="button" className="w-full py-1 text-xs text-muted hover:text-white" onClick={record}>
                  ↻ {es ? "Grabar otra vez" : "Record again"}
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary w-full py-3" disabled={!ready || rec === "recording"} onClick={record}>
                {rec === "recording"
                  ? `${es ? "Grabando" : "Recording"}… ${Math.round(progress * duration)}/${duration}s`
                  : `🎬 ${es ? "Crear video" : "Create video"}`}
              </button>
            )}
            {err && <p className="text-sm text-danger">{err}</p>}
            <p className="text-xs text-muted">
              {es
                ? "La vista previa es exactamente el video. Se graba en tiempo real — deja esta ventana abierta mientras graba. En iPhone toca “Compartir” y luego “Guardar video” o elige TikTok / Instagram."
                : "The preview is exactly the video. It records in real time — keep this window open while it records. On iPhone tap “Share”, then “Save Video” or pick TikTok / Instagram."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The "Make it come alive" call-to-action shown under a finished poster. */
export function MotionCTA({ src, baseName }: { src: string; baseName: string }) {
  const { locale } = useT();
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-xl border border-lime/40 bg-gradient-to-r from-lime/15 via-lime/5 to-transparent p-3 text-left transition hover:border-lime"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-lime/15 text-2xl">🎬</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{es ? "¿Le damos vida? Hazlo video" : "Make it come alive?"}</span>
          <span className="block text-xs text-muted">{es ? "Video con movimiento para TikTok, Reels e Historias · gratis" : "Motion video for TikTok, Reels & Stories · free"}</span>
        </span>
        <span className="text-lime transition group-hover:translate-x-0.5">›</span>
      </button>
      {open && <MotionStudio src={src} baseName={baseName} onClose={() => setOpen(false)} />}
    </>
  );
}
