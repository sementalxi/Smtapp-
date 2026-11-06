/** Line icons for the poster-type picker (replaces emojis). */
const P: Record<string, React.ReactNode> = {
  PLAYER: (
    <>
      <path d="M9 3.5h6l1.5 2.5L20 7.5 18.5 12 16 11v9.5H8V11l-2.5 1L4 7.5 7.5 6z" />
      <path d="M12 13v4" />
    </>
  ),
  CHAMPIONS: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.6M17 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 14v3.5M8.5 20.5h7l-.8-3h-5.4z" />
    </>
  ),
  MATCHDAY: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m10.5 13.5 3 2-3 2z" fill="currentColor" />
    </>
  ),
  LINEUP: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 12h16" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M9 3v3h6V3M9 21v-3h6v3" />
    </>
  ),
  RESULT: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M12 8.5v7" />
      <path d="M6 10.5h2.5v3H6zM15.5 10.5H18v3h-2.5z" />
    </>
  ),
  LOGO: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" />
      <path d="m12 8 1.4 2.8 3.1.5-2.2 2.2.5 3.1L12 15.1l-2.8 1.5.5-3.1-2.2-2.2 3.1-.5z" />
    </>
  ),
  TOTW: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="m12 7.2 1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z" />
      <path d="M8.5 17h7" />
    </>
  ),
  STANDINGS: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M3.5 13.5h17M8 4v16" />
    </>
  ),
  EVENT: (
    <>
      <path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-2a2.5 2.5 0 0 0 0-5z" />
      <path d="M14.5 6v12" strokeDasharray="1.6 1.8" />
      <path d="m9 9.6.9 1.7 1.9.3-1.4 1.3.3 1.9L9 13.9l-1.7.9.3-1.9-1.4-1.3 1.9-.3z" />
    </>
  ),
  QUALIFIERS: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c3.2 3 3.2 14 0 17M12 3.5c-3.2 3-3.2 14 0 17" />
    </>
  ),
  WINNERS: (
    <>
      <rect x="3.5" y="4" width="7.5" height="6.5" rx="1.2" />
      <rect x="13" y="4" width="7.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="13.5" width="7.5" height="6.5" rx="1.2" />
      <rect x="13" y="13.5" width="7.5" height="6.5" rx="1.2" />
      <path d="m7.25 5.6.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="currentColor" />
    </>
  ),
  TEAM: (
    <>
      <rect x="3" y="6" width="9" height="13" rx="1.8" />
      <rect x="12" y="4" width="9" height="13" rx="1.8" />
      <circle cx="16.5" cy="9" r="1.8" />
      <path d="M14 14c.4-1.4 1.3-2 2.5-2s2.1.6 2.5 2" />
    </>
  ),
};

export function TypeIcon({ layout, className = "h-6 w-6" }: { layout: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {P[layout] ?? P.PLAYER}
    </svg>
  );
}
