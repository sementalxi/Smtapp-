import dns from "node:dns/promises";
import net from "node:net";
import sharp from "sharp";

export interface ImageResult {
  thumb: string;
  url: string;
  title: string;
  source: string;
  /** Pixel size of the full image when the search engine knows it. */
  w?: number;
  h?: number;
}

const UA = "KIXO/1.0 (+poster maker)";

/**
 * Which web image search is set up. SERPER_API_KEY gives Google Images results,
 * BRAVE_API_KEY gives Brave image results. Without either we still search
 * TheSportsDB (player cut-outs, team crests) and Wikipedia — free, no key.
 */
export function imageSearchProvider(): "google" | "brave" | "free" {
  if (process.env.SERPER_API_KEY?.trim()) return "google";
  if (process.env.BRAVE_API_KEY?.trim()) return "brave";
  return "free";
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}

const isHttp = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//i.test(u);

export let lastSearchError = "";

async function serper(q: string, page = 1, kind: "photo" | "logo" = "photo"): Promise<ImageResult[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!.trim().replace(/^["']|["']$/g, ""), "Content-Type": "application/json" },
    // Photos: only LARGE real photographs (no clipart / tiny thumbnails) — posters need resolution.
    body: JSON.stringify({ q, num: 30, page, ...(kind === "photo" ? { tbs: "isz:l,itp:photo" } : {}) }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 160);
    throw new Error(`Google search ${res.status}${body ? `: ${body}` : ""}`);
  }
  const data = await res.json();
  return ((data.images ?? []) as Record<string, unknown>[])
    .filter((r) => isHttp(r.imageUrl))
    .map((r) => ({
      url: r.imageUrl as string,
      thumb: isHttp(r.thumbnailUrl) ? r.thumbnailUrl : (r.imageUrl as string),
      title: String(r.title ?? ""),
      source: String(r.domain ?? r.source ?? ""),
      link: String(r.link ?? ""),
      w: Number(r.imageWidth) || undefined,
      h: Number(r.imageHeight) || undefined,
    }));
}

async function brave(q: string, page = 1): Promise<ImageResult[]> {
  const data = await getJson(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(q)}&count=40&offset=${(page - 1) * 40}&safesearch=strict`, {
    headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY!.trim(), Accept: "application/json" },
  });
  return ((data.results ?? []) as { title?: string; source?: string; url?: string; properties?: { url?: string; width?: number; height?: number }; thumbnail?: { src?: string } }[])
    .filter((r) => isHttp(r.properties?.url))
    .map((r) => ({
      url: r.properties!.url!,
      thumb: isHttp(r.thumbnail?.src) ? r.thumbnail!.src! : r.properties!.url!,
      title: r.title ?? "",
      source: r.source ?? "",
      w: r.properties?.width || undefined,
      h: r.properties?.height || undefined,
    }));
}

async function sportsDb(q: string, kind: "photo" | "logo"): Promise<ImageResult[]> {
  const key = process.env.THESPORTSDB_KEY?.trim() || "123";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  if (kind === "logo") {
    const data = await getJson(`${base}/searchteams.php?t=${encodeURIComponent(q)}`);
    return ((data.teams ?? []) as Record<string, string | null>[]).flatMap((t) =>
      [t.strBadge, t.strLogo].filter(isHttp).map((u) => ({ url: u, thumb: `${u}/preview`, title: t.strTeam ?? "", source: "TheSportsDB" })),
    );
  }
  const data = await getJson(`${base}/searchplayers.php?p=${encodeURIComponent(q)}`);
  return ((data.player ?? []) as Record<string, string | null>[]).flatMap((p) =>
    [p.strCutout, p.strRender, p.strThumb]
      .filter(isHttp)
      .map((u) => ({ url: u, thumb: `${u}/preview`, title: [p.strPlayer, p.strTeam].filter(Boolean).join(" · "), source: "TheSportsDB" })),
  );
}

async function wikipedia(q: string): Promise<ImageResult[]> {
  const out: ImageResult[] = [];
  for (const lang of ["en", "es"]) {
    const data = await getJson(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=10&gsrsearch=${encodeURIComponent(q)}&prop=pageimages&piprop=original|thumbnail&pithumbsize=400`,
      { headers: { "User-Agent": UA } },
    ).catch(() => null);
    const pages = Object.values((data?.query?.pages ?? {}) as Record<string, { title: string; index?: number; original?: { source: string }; thumbnail?: { source: string } }>);
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const p of pages) {
      if (!p.original?.source || /\.svg$/i.test(p.original.source)) continue;
      out.push({ url: p.original.source, thumb: p.thumbnail?.source ?? p.original.source, title: p.title, source: "Wikipedia" });
    }
    if (out.length) break;
  }
  return out;
}

export async function searchImages(q: string, kind: "photo" | "logo", page = 1, source: "web" | "pinterest" = "web"): Promise<ImageResult[]> {
  const provider = imageSearchProvider();
  const base = kind === "logo" && provider !== "free" ? `${q} logo crest png` : q;
  // Pinterest: Google results that come from pinterest.com (Pinterest has no public search API;
  // free Serper plans don't allow "site:", so we add the word and filter by domain).
  const query = source === "pinterest" && provider !== "free" ? `${q} pinterest` : base;
  let results: ImageResult[] = [];
  lastSearchError = "";
  // Google/Brave first; if that fails (bad key, no credits…) fall back to the free sources instead of failing.
  try {
    if (provider === "google") results = await serper(query, page, kind);
    else if (provider === "brave") results = await brave(query, page);
  } catch (e) {
    lastSearchError = e instanceof Error ? e.message : String(e);
    console.error("image search provider failed", lastSearchError);
  }
  if (!results.length && page === 1) {
    const [a, b] = await Promise.allSettled([sportsDb(q, kind), wikipedia(q)]);
    results = [...(a.status === "fulfilled" ? a.value : []), ...(b.status === "fulfilled" ? b.value : [])];
  }
  if (source === "pinterest") {
    const pins = results.filter((r) => /pinterest\.|pinimg\.com/i.test(`${r.source} ${(r as ImageResult & { link?: string }).link ?? ""} ${r.url}`));
    if (pins.length) results = pins;
  }
  // Photos smaller than ~500 px come out blurry on a poster — drop them when the size is known.
  if (kind === "photo") results = results.filter((r) => !r.w || !r.h || Math.min(r.w, r.h) >= 500);
  const seen = new Set<string>();
  return results.filter((r) => !seen.has(r.url) && seen.add(r.url)).slice(0, 40);
}

// ─── Downloading a picked image (server side) ──────────────

function privateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

async function assertPublicHost(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad_url");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("bad_url");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("bad_url");
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(privateIp)) throw new Error("bad_url");
}

const browserHeaders = (referer?: string) => ({
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  ...(referer ? { Referer: referer } : {}),
});

/** A public image proxy that fetches with its own headers and converts odd formats (AVIF, HEIC, SVG…) — used when the site blocks us. */
const proxied = (raw: string) => `https://images.weserv.nl/?url=${encodeURIComponent(raw)}&w=2400&h=2400&fit=inside&we`;

/** GET with up to 3 redirects (each hop checked against private hosts) and a size cap. Throws fetch_failed / file_too_large. */
async function fetchBytes(raw: string, maxBytes: number, referer?: string): Promise<Buffer> {
  let url = new URL(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    res = await fetch(url, { redirect: "manual", headers: browserHeaders(referer), signal: AbortSignal.timeout(12_000), cache: "no-store" });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    break;
  }
  if (!res || !res.ok || !res.body) throw new Error("fetch_failed");
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("file_too_large");
  if (/text\/html|application\/json/i.test(res.headers.get("content-type") ?? "")) throw new Error("fetch_failed"); // a login / block page, not a picture
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Error("file_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Decodes any picture sharp understands and normalises it to PNG (with alpha) or JPEG. Throws too_small / unsupported_type. */
async function normalise(buf: Buffer): Promise<{ data: Buffer; type: string }> {
  try {
    const img = sharp(buf, { animated: false }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 120 || meta.height < 120) throw new Error("too_small");
    const resized = img.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });
    return meta.hasAlpha
      ? { data: await resized.png().toBuffer(), type: "image/png" }
      : { data: await resized.jpeg({ quality: 90 }).toBuffer(), type: "image/jpeg" };
  } catch (e) {
    throw new Error(e instanceof Error && e.message === "too_small" ? "too_small" : "unsupported_type");
  }
}

/**
 * Fetches an image from the web (only public hosts, at most 15 MB, following up to 3 redirects, each one
 * re-checked) and normalises it to PNG or JPEG. Sites that block hotlinking or serve odd formats are retried
 * through an image proxy, and as a last resort the search engine's thumbnail is used.
 */
export async function downloadImage(raw: string, maxBytes = 15 * 1024 * 1024, opts: { thumb?: string } = {}): Promise<{ data: Buffer; type: string }> {
  const origin = (() => {
    try {
      return new URL(raw).origin + "/";
    } catch {
      return undefined;
    }
  })();
  const thumb = opts.thumb && opts.thumb !== raw && /^https?:\/\//.test(opts.thumb) ? opts.thumb : null;
  const attempts: Array<() => Promise<Buffer>> = [
    () => fetchBytes(raw, maxBytes, origin),
    () => fetchBytes(proxied(raw), maxBytes),
    ...(thumb ? [() => fetchBytes(thumb, maxBytes), () => fetchBytes(proxied(thumb), maxBytes)] : []),
  ];
  let last: Error = new Error("fetch_failed");
  for (const attempt of attempts) {
    try {
      return await normalise(await attempt());
    } catch (e) {
      last = e instanceof Error ? e : new Error("fetch_failed");
      if (last.message === "file_too_large") throw last;
    }
  }
  throw last;
}
