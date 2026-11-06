"use client";

import { badgeLabel, parseBadges, type StyleBadge } from "@/lib/templates";

/**
 * The labels an admin puts on a style (⭐ Recommended, 🔥 Fire, 🎨 Photoshop, ✨ New) — several at once,
 * stacked in the card's corner, each with its own glow and a shine sweep (see .style-badge in globals.css).
 */
export function StyleBadges({ badge, es, className = "" }: { badge: string | null | undefined; es: boolean; className?: string }) {
  const list = parseBadges(badge);
  if (!list.length) return null;
  return (
    <span className={`pointer-events-none absolute top-1.5 left-1.5 z-[2] flex flex-col items-start gap-1 ${className}`}>
      {list.map((b: StyleBadge) => (
        <span key={b} className={`style-badge style-badge-${b}`}>
          <span className="style-badge-shine" />
          {badgeLabel(b, es)}
        </span>
      ))}
    </span>
  );
}
