export function SoonCard({ es, title, icon }: { es: boolean; title: string; icon: string }) {
  return (
    <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
      <div className="text-5xl">{icon}</div>
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="inline-block rounded-full border border-amber-300/60 px-3 py-1 text-xs font-black tracking-wider text-amber-200">⏳ {es ? "PRÓXIMAMENTE" : "COMING SOON"}</p>
      <p className="text-sm text-muted">{es ? "Estamos terminando los detalles. ¡Muy pronto podrás usarlo!" : "We're putting on the finishing touches. You'll be able to use it very soon!"}</p>
      <a href="/create" className="btn-primary inline-block">{es ? "Volver a Crear" : "Back to Create"}</a>
    </div>
  );
}
