"use client";

import { useState } from "react";

export function CopyLink({ link, es }: { link: string; es: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const i = document.createElement("textarea");
      i.value = link;
      document.body.appendChild(i);
      i.select();
      document.execCommand("copy");
      i.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "KIXO", text: es ? "Crea pósters deportivos pro con IA 🔥" : "Make pro sports posters with AI 🔥", url: link });
      } catch {
        /* closed */
      }
    } else copy();
  };
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted">{es ? "Tu enlace personal" : "Your personal link"}</div>
      <div className="rounded-xl border border-line bg-ink/60 px-3 py-3 font-mono text-sm break-all">{link}</div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="btn-primary py-3">{done ? (es ? "✓ Copiado" : "✓ Copied") : es ? "Copiar enlace" : "Copy link"}</button>
        <button type="button" onClick={share} className="btn-ghost py-3">↗ {es ? "Compartir" : "Share"}</button>
      </div>
    </div>
  );
}
