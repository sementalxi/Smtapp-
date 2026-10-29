"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { EMPTY_INPUTS } from "@/lib/templates";
import { ImageDrop } from "../ImageDrop";
import { DownloadSizes } from "../DownloadSizes";

/** Team set: next player card with the same design as an earlier card. */
export function TeamSetForm({
  match,
  credits: initialCredits,
  cost,
}: {
  match: { id: string; imageUrl: string; team: string; count: number };
  credits: number;
  cost: number;
}) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", position: "", number: "", tagline: "", subtitle: "" });
  const [credits, setCredits] = useState(initialCredits);
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);
  const [made, setMade] = useState(0);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (phase !== "busy") return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const field = (k: keyof typeof f, label: string, max: number, req = false, ph = "") => (
    <div>
      <label className="label">
        {label} {req && <span className="text-lime">*</span>}
      </label>
      <input className="input" maxLength={max} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  async function generate() {
    setPhase("busy");
    setError("");
    const res = await fetch("/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: "match",
        matchBannerId: match.id,
        mode: "PRO",
        photoUrl: photo,
        inputs: { ...EMPTY_INPUTS, ...f },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      setResult({ id: data.id, url: data.finalUrl ?? null });
      setCredits((c) => c - cost);
      setMade((n) => n + 1);
      setPhase("done");
      router.refresh();
    } else {
      setError(
        data.error === "err_credits"
          ? es ? "No tienes créditos suficientes." : "You don't have enough credits."
          : (es ? "Algo salió mal." : "Something went wrong.") + (data.detail ? ` — ${data.detail}` : ""),
      );
      setPhase("error");
    }
  }

  function nextPlayer() {
    setPhoto(null);
    setF({ name: "", position: "", number: "", tagline: "", subtitle: "" });
    setResult(null);
    setPhase("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canGo = !!photo && !!f.name.trim() && credits >= cost && phase !== "busy";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card mb-5 flex items-center gap-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={match.imageUrl} alt="" className="h-28 w-[90px] shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <span className="chip border-lime bg-lime/10 text-[10px] text-lime">👥 {es ? "SET DE EQUIPO" : "TEAM SET"}</span>
          <div className="mt-1 text-lg font-extrabold">
            {es ? "Mismo diseño para todo el equipo" : "Same design for the whole team"}
            {match.team ? ` · ${match.team}` : ""}
          </div>
          <p className="text-sm text-muted">
            {es
              ? "Sube la foto del siguiente jugador y sus datos. La IA copia el fondo, colores, letras y logo de esta tarjeta."
              : "Add the next player's photo and details. The AI copies this card's background, colors, lettering and logo."}
          </p>
          {match.count + made > 1 && (
            <p className="mt-1 text-xs text-lime">
              {match.count + made} {es ? "tarjetas en este set" : "cards in this set"}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card space-y-4 p-5">
          <ImageDrop kind="photo" label={`${es ? "Foto del jugador" : "Player photo"} *`} value={photo} onChange={setPhoto} searchQuery={[f.name, match.team].filter(Boolean).join(" ")} />
          {field("name", es ? "Nombre del jugador" : "Player name", 40, true)}
          <div className="grid grid-cols-2 gap-3">
            {field("position", es ? "Posición" : "Position", 24, false, "ST")}
            {field("number", es ? "Número" : "Number", 4, false, "10")}
          </div>
          {field("tagline", es ? "Palabra pequeña arriba del nombre" : "Small word above the name", 30)}
          {field("subtitle", es ? "Frase de acento" : "Accent line", 40)}
        </div>

        <div className="space-y-3">
          <div className="card grid aspect-[4/5] place-items-center overflow-hidden">
            {phase === "done" && result?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="" className="h-full w-full object-cover" />
            ) : phase === "busy" ? (
              <div className="p-6 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-lime border-t-transparent" />
                <p className="mt-4 text-sm text-lime">{es ? "Creando la tarjeta…" : "Making the card…"} {secs}s</p>
                <p className="mt-1 text-xs text-muted">{es ? "Tarda 1–2 minutos. No cierres esta página." : "Takes 1–2 minutes. Keep this page open."}</p>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted">
                {phase === "error" ? <span className="text-danger">{error}</span> : es ? "Aquí aparecerá la tarjeta." : "The card will appear here."}
              </div>
            )}
          </div>

          {phase === "done" && result ? (
            <>
              {result.url && <DownloadSizes src={result.url} baseName={`kixo-${f.name || "player"}`} />}
              <button type="button" className="btn-primary w-full py-3" onClick={nextPlayer}>
                👥 {es ? "Siguiente jugador — mismo diseño" : "Next player — same design"}
              </button>
              <Link href={`/banner/${result.id}`} className="btn-ghost w-full">✏️ {es ? "Editar esta tarjeta" : "Edit this card"}</Link>
            </>
          ) : (
            <button type="button" className="btn-primary w-full py-3" disabled={!canGo} onClick={generate}>
              ✨ {es ? "Crear tarjeta" : "Make card"} · {cost} {es ? "créditos" : "credits"}
            </button>
          )}
          <div className="flex justify-between text-xs text-muted">
            <span>{es ? "Saldo" : "Balance"}: <b className="text-lime">{credits}</b></span>
            {credits < cost && <Link href="/pricing" className="text-lime">{es ? "Comprar créditos" : "Get credits"}</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
