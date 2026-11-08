/** Simple, readable legal page: title, last-updated date, sections. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[] }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-1 text-xs text-muted">{updated}</p>
      <p className="mt-5 text-sm leading-relaxed text-white/85">{intro}</p>
      <div className="mt-6 space-y-6">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-bold">{s.h}</h2>
            {s.p.map((t, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-white/80">{t}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
