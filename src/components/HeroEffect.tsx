// Background motion effects for the home hero. The admin picks one (Setting "hero_effect").
export const HERO_EFFECTS = [
  { id: "stadium", en: "Stadium lights", es: "Luces de estadio", icon: "🏟️" },
  { id: "smoke", en: "Smoke", es: "Humo", icon: "🌫️" },
  { id: "fire", en: "Fire embers", es: "Brasas de fuego", icon: "🔥" },
  { id: "lightning", en: "Lightning", es: "Relámpagos", icon: "⚡" },
  { id: "rain", en: "Rain", es: "Lluvia", icon: "🌧️" },
  { id: "speed", en: "Speed lines", es: "Líneas de velocidad", icon: "💨" },
  { id: "grid", en: "Neon grid", es: "Rejilla neón", icon: "🟩" },
  { id: "stars", en: "Starfield", es: "Estrellas", icon: "✨" },
  { id: "aurora", en: "Aurora", es: "Aurora", icon: "🌌" },
  { id: "confetti", en: "Confetti", es: "Confeti", icon: "🎉" },
  { id: "none", en: "No effect", es: "Sin efecto", icon: "⬛" },
] as const;
export type HeroEffectId = (typeof HERO_EFFECTS)[number]["id"];

// Fixed pseudo-random positions (same on server and client).
const seq = (n: number, k: number, m = 100) => Array.from({ length: n }, (_, i) => (i * k + 13) % m);

export function HeroEffect({ effect }: { effect: string }) {
  const e = (HERO_EFFECTS.some((x) => x.id === effect) ? effect : "stadium") as HeroEffectId;
  if (e === "none") return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {e === "stadium" && (
        <>
          <div className="kixo-beam" style={{ left: "8%" }} />
          <div className="kixo-beam" style={{ right: "4%", animationDelay: "-4.5s", animationDuration: "11s" }} />
          <div className="kixo-fog bottom-[-10%] left-[-10%] h-72 w-[70%] bg-teal/15" />
          <div className="kixo-fog top-[20%] right-[-15%] h-80 w-[60%] bg-lime/10" style={{ animationDelay: "-9s" }} />
          {seq(18, 37).map((x, n) => (
            <span key={n} className="kixo-spark" style={{ left: `${x}%`, bottom: "-12px", width: 2 + (n % 3), height: 2 + (n % 3), animationDuration: `${7 + (n % 5) * 2}s`, animationDelay: `-${(n * 1.7) % 12}s`, opacity: 0.7 }} />
          ))}
        </>
      )}
      {e === "smoke" &&
        [0, 1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="fx-smoke"
            style={{ left: `${-20 + n * 22}%`, bottom: `${-30 + (n % 3) * 15}%`, animationDelay: `-${n * 3.3}s`, animationDuration: `${16 + (n % 3) * 4}s`, background: n % 2 ? "rgba(70,213,174,0.18)" : "rgba(220,235,225,0.12)" }}
          />
        ))}
      {e === "fire" && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-orange-600/25 via-red-600/10 to-transparent" />
          <div className="fx-heat absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-orange-500/20 to-transparent" />
          {seq(34, 29).map((x, n) => (
            <span key={n} className="fx-ember" style={{ left: `${x}%`, width: 2 + (n % 4), height: 2 + (n % 4), animationDuration: `${4 + (n % 6)}s`, animationDelay: `-${(n * 0.9) % 8}s` }} />
          ))}
        </>
      )}
      {e === "lightning" && (
        <>
          <div className="fx-flash absolute inset-0 bg-white" />
          <div className="fx-flash absolute inset-0 bg-teal" style={{ animationDelay: "-3.1s", animationDuration: "7.3s" }} />
          <svg className="fx-bolt absolute top-0 right-[18%] h-[70%] w-auto" viewBox="0 0 60 200" fill="none" stroke="#e8fff4" strokeWidth="2.5">
            <path d="M34 0 22 70 38 74 18 140 30 142 12 200" />
          </svg>
          <svg className="fx-bolt absolute top-0 left-[12%] h-[55%] w-auto" viewBox="0 0 60 200" fill="none" stroke="#b7ff45" strokeWidth="2" style={{ animationDelay: "-2.6s", animationDuration: "6.7s" }}>
            <path d="M28 0 38 60 22 66 40 130 26 134 36 200" />
          </svg>
        </>
      )}
      {e === "rain" && (
        <>
          <div className="fx-rain absolute -inset-[20%]" />
          <div className="fx-rain absolute -inset-[20%] opacity-60" style={{ animationDuration: "0.55s", backgroundSize: "120px 160px" }} />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-teal/10 to-transparent" />
        </>
      )}
      {e === "speed" &&
        seq(16, 41).map((y, n) => (
          <span key={n} className="fx-streak" style={{ top: `${y}%`, width: `${18 + (n % 4) * 10}%`, animationDuration: `${0.9 + (n % 5) * 0.35}s`, animationDelay: `-${(n * 0.37) % 2}s`, background: n % 3 ? "linear-gradient(90deg,transparent,rgba(183,255,69,0.8),transparent)" : "linear-gradient(90deg,transparent,rgba(70,213,174,0.8),transparent)" }} />
        ))}
      {e === "grid" && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-[55%] [perspective:400px]">
            <div className="fx-grid absolute inset-x-[-50%] bottom-0 h-[200%] origin-bottom [transform:rotateX(65deg)]" />
          </div>
          <div className="absolute inset-x-0 top-[44%] h-px bg-lime/60 shadow-[0_0_30px_6px_rgba(183,255,69,0.35)]" />
        </>
      )}
      {e === "stars" &&
        seq(60, 53).map((x, n) => (
          <span key={n} className="fx-star" style={{ left: `${x}%`, top: `${(n * 71 + 7) % 100}%`, width: 1 + (n % 3), height: 1 + (n % 3), animationDelay: `-${(n * 0.43) % 4}s`, animationDuration: `${2 + (n % 4)}s` }} />
        ))}
      {e === "aurora" && (
        <>
          <div className="fx-aurora absolute -inset-x-1/4 top-[-20%] h-[80%]" style={{ background: "linear-gradient(100deg, transparent 10%, rgba(183,255,69,0.22) 30%, rgba(70,213,174,0.28) 50%, transparent 75%)" }} />
          <div className="fx-aurora absolute -inset-x-1/4 top-[0%] h-[70%]" style={{ animationDelay: "-6s", animationDuration: "15s", background: "linear-gradient(80deg, transparent 15%, rgba(70,213,174,0.2) 40%, rgba(120,90,255,0.14) 60%, transparent 80%)" }} />
        </>
      )}
      {e === "confetti" &&
        seq(40, 31).map((x, n) => (
          <span
            key={n}
            className="fx-confetti"
            style={{ left: `${x}%`, width: 6 + (n % 3) * 2, height: 10 + (n % 2) * 4, background: ["#b7ff45", "#46d5ae", "#f1f8f3", "#ffd23f", "#ff5c8a"][n % 5], animationDuration: `${5 + (n % 5)}s`, animationDelay: `-${(n * 0.7) % 9}s` }}
          />
        ))}
    </div>
  );
}
