"use client";

import { useEffect, useState } from "react";
import { soundOn, setSoundOn } from "@/lib/sfx";

/** Profile card: website sounds on/off (saved in this browser). */
export function SoundToggle({ es }: { es: boolean }) {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(soundOn()), []);
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-2xl">{on ? "🔊" : "🔇"}</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{es ? "Sonidos" : "Sounds"}</div>
        <div className="text-xs text-muted">{es ? "Toques, póster listo y mensajes de soporte." : "Taps, poster ready and support messages."}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => { const v = !on; setOn(v); setSoundOn(v); }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-lime" : "bg-line"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-ink transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
