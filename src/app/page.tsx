import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { activeTemplates } from "@/lib/queries";
import { getNumberSetting } from "@/lib/settings";
import { TemplateThumb } from "@/components/TemplateThumb";
import { PricingCards } from "@/components/PricingCards";
import { ART_TYPES } from "@/lib/pro-options";
import type { ClientTemplate } from "@/lib/samples";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  const { locale } = await getT();
  const es = locale === "es";
  let templates: ClientTemplate[] = [];
  let bonus = 3;
  let cost = 4;
  try {
    templates = await activeTemplates();
    bonus = await getNumberSetting("signup_credits");
    cost = await getNumberSetting("pro_cost");
  } catch {
    /* DB not ready */
  }
  // Three contrasting styles for the fanned card stack
  const pickSlugs = ["inferno", "glacier", "golden-champions"];
  const fan = pickSlugs.map((s) => templates.find((t) => t.slug === s)).filter(Boolean) as ClientTemplate[];
  const hero = fan.length === 3 ? fan : templates.slice(0, 3);
  const cta = user ? "/create" : "/register";

  const steps = es
    ? [
        ["Elige qué crear", "Tarjeta de jugador, campeones, día de partido, alineación o resultado."],
        ["Sube foto y escudo", "Tu equipo y tu torneo quedan guardados para la próxima."],
        ["Elige estilo y letras", "Cada póster sale con su propia paleta y fondo."],
        ["Descarga", "Post, historia y banner, listos para publicar."],
      ]
    : [
        ["Pick what to make", "Player card, champions, match day, lineup or result."],
        ["Add your photo and crest", "Your team and competition are saved for next time."],
        ["Choose a style and type", "Every poster comes out with its own palette and background."],
        ["Download", "Post, story and banner sizes, ready to publish."],
      ];

  return (
    <div className="overflow-x-clip">
      {/* ── Hero: the logo is the moment ── */}
      <section className="relative">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
          <div>
            <div className="sweep relative inline-block overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kixo-logo.png" alt="KIXO" className="h-auto w-[min(520px,86vw)] drop-shadow-[0_10px_40px_rgb(57_215_255/0.25)]" />
            </div>
            <h1 className="font-display chrome mt-6 max-w-xl text-[clamp(2.6rem,7vw,4.6rem)]">
              {es ? "Gráficos que pegan como una final." : "Matchday graphics that hit like a final."}
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-steel/80">
              {es
                ? "Sube una foto y tu escudo. KIXO crea tarjetas de jugador, pósters de campeones, alineaciones y resultados para tu club de Pro Clubs."
                : "Upload a photo and your crest. KIXO builds player cards, champions posters, lineups and results for your Pro Clubs team."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={cta} className="btn-primary px-7 py-4 text-base">
                {es ? "Crear mi primer póster" : "Create my first poster"}
              </Link>
              <Link href="/pricing" className="btn-ghost px-6 py-4 text-base">
                {es ? "Ver precios" : "See prices"}
              </Link>
            </div>
            {bonus > 0 && (
              <p className="mt-4 text-sm text-muted">
                {es ? `${bonus} créditos gratis al registrarte. Sin tarjeta.` : `${bonus} free credits when you sign up. No card needed.`}
              </p>
            )}
          </div>

          {/* fanned card stack */}
          <div className="relative mx-auto h-[420px] w-full max-w-[460px] sm:h-[520px]">
            {hero.map((tpl, i) => (
              <div
                key={tpl.id}
                className={`absolute top-1/2 left-1/2 w-[58%] ${i === 1 ? "neon-frame-cyan" : "neon-frame"}`}
                style={{
                  transform: `translate(-50%, -50%) translateX(${(i - 1) * 34}%) rotate(${(i - 1) * 9}deg) translateY(${i === 1 ? -4 : 6}%)`,
                  zIndex: i === 1 ? 3 : 1,
                  filter: i === 1 ? "none" : "brightness(0.72) saturate(0.9)",
                }}
              >
                <TemplateThumb template={tpl} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can make ── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display chrome mb-2 text-4xl sm:text-5xl">{es ? "Todo lo que tu club publica" : "Everything your club posts"}</h2>
        <p className="mb-8 max-w-lg text-muted">
          {es ? `Cada póster cuesta ${cost} créditos. Editar el texto y descargar en otros tamaños es gratis.` : `Each poster costs ${cost} credits. Editing the text and downloading other sizes is free.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ART_TYPES.map((a) => (
            <Link
              key={a.layout}
              href={user ? `/create?type=${a.layout.toLowerCase()}` : "/register"}
              className="card group flex items-start gap-4 p-5 transition hover:border-lime/50"
            >
              <span className="text-3xl" aria-hidden>{a.icon}</span>
              <span>
                <span className="block text-lg font-bold group-hover:text-lime">{es ? a.es.name : a.en.name}</span>
                <span className="mt-0.5 block text-sm text-muted">{es ? a.es.desc : a.en.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── How it works (a real sequence) ── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-display chrome mb-8 text-4xl sm:text-5xl">{es ? "Así de fácil" : "This is how easy"}</h2>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="bg-panel p-6">
              <span className="font-display neon-cyan text-5xl">{i + 1}</span>
              <span className="mt-3 block text-lg font-bold">{title}</span>
              <span className="mt-1 block text-sm text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Styles ── */}
      {templates.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-display chrome mb-8 text-4xl sm:text-5xl">{es ? "Estilos" : "Styles"}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {templates.map((tpl) => (
              <Link key={tpl.id} href={user ? `/create?type=${tpl.layout.toLowerCase()}` : "/register"} className="group">
                <div className="neon-frame transition group-hover:shadow-[0_0_0_2px_#00e5ff,0_0_30px_rgb(0_229_255/0.6)]">
                  <TemplateThumb template={tpl} />
                </div>
                <div className="mt-2 text-sm font-semibold text-steel group-hover:text-lime">{es ? tpl.nameEs : tpl.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Pricing ── */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="font-display chrome mb-2 text-4xl sm:text-5xl">{es ? "Créditos y planes" : "Credits and plans"}</h2>
        <p className="mb-10 text-muted">{es ? "Paga solo lo que uses, o suscríbete y recibe créditos cada mes." : "Pay as you go, or subscribe and get credits every month."}</p>
        <PricingCards user={user} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="font-display chrome mx-auto max-w-2xl text-[clamp(2.2rem,6vw,4rem)]">
          {es ? "Tu próximo póster está a dos minutos." : "Your next poster is two minutes away."}
        </h2>
        <Link href={cta} className="btn-primary mt-8 px-8 py-4 text-base">
          {es ? "Empezar gratis" : "Start free"}
        </Link>
      </section>
    </div>
  );
}
