/** Shown instantly while a page is being prepared on the server. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kixo-wordmark.png" alt="" className="h-6 w-auto animate-pulse opacity-60 [filter:hue-rotate(246deg)]" />
        <span className="skeleton h-4 w-40" />
      </div>
      <div className="skeleton mt-8 h-10 w-2/3 max-w-sm" />
      <div className="skeleton mt-3 h-4 w-1/2 max-w-xs" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="skeleton block aspect-[4/5] w-full" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
