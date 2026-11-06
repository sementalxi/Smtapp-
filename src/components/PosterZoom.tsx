"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The poster image with a tap-to-open full-screen viewer: pinch to zoom, drag to pan, double-tap to zoom;
 * on a computer: wheel to zoom, drag to pan, double-click to zoom, click / Esc to close. The page itself never
 * zooms, so the layout stays put. The viewer is rendered on <body> (a portal), so no sticky header, toolbar or
 * transformed parent on the page can sit on top of it or cut it.
 */
export function PosterZoom({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [tf, setTf] = useState({ s: 1, x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ d: number; s: number; x: number; y: number; cx: number; cy: number; moved: boolean; lastTap: number } | null>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches), []);

  useEffect(() => {
    if (!open) return;
    setTf({ s: 1, x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const clamp = (v: { s: number; x: number; y: number }) => {
    const s = Math.min(5, Math.max(1, v.s));
    const box = ref.current?.getBoundingClientRect();
    const maxX = box ? ((s - 1) * box.width) / 2 : 0;
    const maxY = box ? ((s - 1) * box.height) / 2 : 0;
    return { s, x: s === 1 ? 0 : Math.min(maxX, Math.max(-maxX, v.x)), y: s === 1 ? 0 : Math.min(maxY, Math.max(-maxY, v.y)) };
  };
  type Pts = { length: number; [i: number]: { clientX: number; clientY: number } };
  const dist = (t: Pts) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches;
    gesture.current = {
      d: t.length === 2 ? dist(t) : 0,
      s: tf.s,
      x: tf.x,
      y: tf.y,
      cx: t[0].clientX,
      cy: t[0].clientY,
      moved: false,
      lastTap: gesture.current?.lastTap ?? 0,
    };
  }
  function onTouchMove(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches;
    g.moved = true;
    if (t.length === 2 && g.d) {
      setTf(clamp({ s: g.s * (dist(t) / g.d), x: g.x, y: g.y }));
    } else if (t.length === 1 && tf.s > 1) {
      setTf(clamp({ s: tf.s, x: g.x + (t[0].clientX - g.cx), y: g.y + (t[0].clientY - g.cy) }));
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g || e.touches.length) return;
    const now = Date.now();
    if (!g.moved) {
      if (now - g.lastTap < 300) {
        // Double tap: zoom in around the tap, or reset.
        setTf((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : clamp({ s: 2.5, x: (window.innerWidth / 2 - g.cx) * 1.5, y: (window.innerHeight / 2 - g.cy) * 1.5 })));
        g.lastTap = 0;
      } else g.lastTap = now;
    }
  }
  function onWheel(e: React.WheelEvent) {
    setTf((v) => clamp({ s: v.s * (e.deltaY < 0 ? 1.15 : 0.87), x: v.x, y: v.y }));
  }
  // Mouse: drag to pan when zoomed, double-click to zoom in around the cursor (or back out).
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    drag.current = { x: tf.x, y: tf.y, sx: e.clientX, sy: e.clientY, moved: false };
  }
  function onMouseMove(e: React.MouseEvent) {
    const d = drag.current;
    if (!d || tf.s === 1) return;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    setTf(clamp({ s: tf.s, x: d.x + (e.clientX - d.sx), y: d.y + (e.clientY - d.sy) }));
  }
  function onMouseUp() {
    setTimeout(() => (drag.current = null), 0);
  }
  function onDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setTf((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : clamp({ s: 2.5, x: (window.innerWidth / 2 - e.clientX) * 1.5, y: (window.innerHeight / 2 - e.clientY) * 1.5 })));
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`${className} cursor-zoom-in`} onClick={() => setOpen(true)} />
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={ref}
          className={`fixed inset-0 z-[1000] overflow-hidden bg-black/95 [touch-action:none] ${tf.s > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-out"}`}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
          onClick={() => !drag.current?.moved && tf.s === 1 && setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full select-none object-contain"
            style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.s})`, transition: gesture.current?.moved || drag.current?.moved ? "none" : "transform 0.2s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="Close"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur hover:bg-white/20"
            style={{ top: "max(12px, env(safe-area-inset-top))" }}
          >
            ×
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[11px] font-semibold text-white/50">{tf.s > 1 ? `${tf.s.toFixed(1)}×` : touch ? "pinch · double-tap" : "scroll or double-click to zoom · click to close"}</div>
        </div>,
        document.body,
      )}
    </>
  );
}
