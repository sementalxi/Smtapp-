"use client";

/** "Run a league?" for players who don't have the league tools yet: opens live support with a ready message to claim the league / organization role. */
export function ClaimLeagueButton({ es, children, className }: { es: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("kixo:support", {
            detail: {
              topic: "support",
              text: es
                ? "Hola 👋 Organizo una liga y quiero reclamar el rol de liga / organización. Nombre de la liga: "
                : "Hi 👋 I run a league and want to claim the league / organization role. League name: ",
            },
          }),
        )
      }
    >
      {children}
    </button>
  );
}
