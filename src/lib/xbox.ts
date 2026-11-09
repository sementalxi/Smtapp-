// Xbox gamertag search through OpenXBL (xbl.io — a third-party Xbox Live API). Needs OPENXBL_API_KEY in Vercel;
// without it the search is simply not offered. Returns public profile info only: gamertag, gamerscore, gamerpic.
export const xboxSearchReady = () => !!process.env.OPENXBL_API_KEY?.trim();

export type XboxHit = { xuid: string; gamertag: string; pic: string; gamerscore: string };

/** Only Xbox's own image hosts are accepted as a gamerpic. */
export function isXboxPic(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)xboxlive\.com$|(^|\.)xbox\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

type Raw = { xuid?: string; id?: string; gamertag?: string; modernGamertag?: string; displayName?: string; displayPicRaw?: string; gamerScore?: string | number; settings?: { id: string; value: string }[] };

function norm(r: Raw): XboxHit | null {
  const s = (id: string) => r.settings?.find((x) => x.id === id)?.value;
  const xuid = r.xuid ?? r.id ?? "";
  const gamertag = r.gamertag ?? r.modernGamertag ?? s("Gamertag") ?? r.displayName ?? "";
  let pic = r.displayPicRaw ?? s("GameDisplayPicRaw") ?? "";
  if (pic && !/[?&]w=/.test(pic)) pic += (pic.includes("?") ? "&" : "?") + "w=256&h=256";
  if (!xuid || !gamertag) return null;
  return { xuid, gamertag, pic: isXboxPic(pic) ? pic : "", gamerscore: String(r.gamerScore ?? s("Gamerscore") ?? "") };
}

export async function searchXbox(q: string): Promise<XboxHit[]> {
  const key = process.env.OPENXBL_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch(`https://xbl.io/api/v2/search/${encodeURIComponent(q)}`, {
    headers: { "X-Authorization": key, Accept: "application/json", "Accept-Language": "en-US" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`OpenXBL ${res.status}`);
  const d = (await res.json()) as { people?: Raw[]; profileUsers?: Raw[]; content?: { people?: Raw[] } };
  const list = d.people ?? d.content?.people ?? d.profileUsers ?? [];
  const out = list.map(norm).filter((x): x is XboxHit => !!x);
  // exact match first
  const k = q.trim().toLowerCase();
  out.sort((a, b) => Number(b.gamertag.toLowerCase() === k) - Number(a.gamertag.toLowerCase() === k));
  return out.slice(0, 6);
}
