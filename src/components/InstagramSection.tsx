import { getInstagramFeed } from "@/lib/instagram";

/** Home page: the organization's latest Instagram posts (shown only when the admin turned it on and the feed loads). */
export async function InstagramSection({ es }: { es: boolean }) {
  const feed = await getInstagramFeed().catch(() => null);
  if (!feed || !feed.posts.length) return null;
  const handle = feed.username.replace(/^@/, "");
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-lime sm:text-xs">📸 Instagram</div>
            <h2 className="font-display mt-1 text-3xl sm:text-4xl">@{handle}</h2>
            <p className="mt-1 text-sm text-muted">{es ? "Lo último que publicamos — síguenos para no perderte nada." : "Our latest posts — follow us so you don't miss a thing."}</p>
          </div>
          <a href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2.5 text-sm">
            {es ? "Seguir en Instagram" : "Follow on Instagram"} ›
          </a>
        </div>
        <div data-reveal className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {feed.posts.slice(0, 9).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-panel-2 sm:rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.caption || "Instagram post"} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              {p.type === "VIDEO" && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">▶</span>}
              <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[11px] text-white/90 opacity-0 transition group-hover:opacity-100">{p.caption}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
