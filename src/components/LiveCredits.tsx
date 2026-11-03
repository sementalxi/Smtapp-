"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sfx } from "@/lib/sfx";

/** Header credit badge that stays in sync (admin adds credits, purchases, refunds…) without a refresh. */
export function LiveCredits({ initial, es, word, wordOne }: { initial: number; es: boolean; word: string; wordOne: string }) {
  const router = useRouter();
  const [credits, setCredits] = useState(initial);
  const [toast, setToast] = useState<string>("");
  const [flash, setFlash] = useState(false);
  const cur = useRef<number>(initial);
  useEffect(() => { cur.current = initial; setCredits(initial); }, [initial]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const d = await fetch("/api/me/credits", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!alive || typeof d?.credits !== "number" || d.credits === cur.current) return;
      const diff = d.credits - (cur.current ?? 0);
      cur.current = d.credits;
      setCredits(d.credits);
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      if (diff > 0) {
        const why = d.last?.type === "ADMIN_ADJUST" ? (es ? " — regalo del admin 🎁" : " — gift from the admin 🎁") : d.last?.type === "REFUND" ? (es ? " — reembolso" : " — refund") : "";
        setToast(`⚡ +${diff} ${es ? "créditos" : "credits"}${why}`);
        sfx("success");
        setTimeout(() => setToast(""), 5000);
      }
      router.refresh(); // other numbers on the page update too
    };
    const t = setInterval(check, 10000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [es, router]);

  return (
    <>
      <span className={`transition ${flash ? "scale-125 text-white" : ""} inline-block`}>⚡ {credits}</span>
      <span className="hidden sm:inline"> {credits === 1 ? wordOne : word}</span>
      {toast && (
        <span className="kixo-fade-up fixed left-1/2 top-20 z-[80] -translate-x-1/2 whitespace-nowrap rounded-full border border-lime/50 bg-panel/95 px-4 py-2 text-sm font-extrabold text-lime shadow-[0_10px_40px_-10px] shadow-lime/60 backdrop-blur">
          {toast}
        </span>
      )}
    </>
  );
}
