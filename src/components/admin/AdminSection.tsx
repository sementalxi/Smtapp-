/** Folding section for long admin pages: icon + title + one-line summary; tap to open. */
export function AdminSection({ icon, title, sub, open, children }: { icon: string; title: string; sub?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group overflow-hidden rounded-2xl border border-line bg-panel/70">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-xl">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{title}</span>
          {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
        </span>
        <span className="text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 border-t border-line p-4">{children}</div>
    </details>
  );
}
