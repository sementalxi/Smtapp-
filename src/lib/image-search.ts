import dns from "node:dns/promises";
import net from "node:net";
import sharp from "sharp";

export interface ImageResult {
  thumb: string;
  url: string;
  title: string;
  source: string;
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

async function serper(q: string): Promise<ImageResult[]> {
  const data = await getJson("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": process.env.SERPER_API_KEY!.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 40 }),
  });
  return ((data.images ?? []) as Record<string, unknown>[])
    .filter((r) => isHttp(r.imageUrl))
    .map((r) => ({
      url: r.imageUrl as string,
      thumb: isHttp(r.thumbnailUrl) ? r.thumbnailUrl : (r.imageUrl as string),
      title: String(r.title ?? ""),
      source: String(r.source ?? r.domain ?? ""),
    }));
}

async function brave(q: string): Promise<ImageResult[]> {
  const data = await getJson(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(q)}&count=40&safesearch=strict`, {
    headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY!.trim(), Accept: "application/json" },
  });
  return ((data.results ?? []) as { title?: string; source?: string; url?: string; properties?: { url?: string }; thumbnail?: { src?: string } }[])
    .filter((r) => isHttp(r.properties?.url))
    .map((r) => ({
      url: r.properties!.url!,
      thumb: isHttp(r.thumbnail?.src) ? r.thumbnail!.src! : r.properties!.url!,
      title: r.title ?? "",
      source: r.source ?? "",
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

export async function searchImages(q: string, kind: "photo" | "logo"): Promise<ImageResult[]> {
  const provider = imageSearchProvider();
  const query = kind === "logo" && provider !== "free" ? `${q} logo crest png` : q;
  let results: ImageResult[] = [];
  if (provider === "google") results = await serper(query);
  else if (provider === "brave") results = await brave(query);
  else {
    const [a, b] = await Promise.allSettled([sportsDb(q, kind), wikipedia(q)]);
    results = [...(a.status === "fulfilled" ? a.value : []), ...(b.status === "fulfilled" ? b.value : [])];
  }
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

/**
 * Fetches an image from the web (only public hosts, at most 15 MB, following up
 * to 3 redirects, each one re-checked) and normalises it to PNG or JPEG.
 */
export async function downloadImage(raw: string, maxBytes = 15 * 1024 * 1024): Promise<{ data: Buffer; type: string }> {
  let url = new URL(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KIXO/1.0)", Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    break;
  }
  if (!res || !res.ok || !res.body) throw new Error("fetch_failed");
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) throw new Error("file_too_large");

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
  const buf = Buffer.concat(chunks);

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
