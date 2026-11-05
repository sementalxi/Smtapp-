// Tiny in-memory cache shared by requests on the same server instance (Vercel reuses warm instances).
// Used for data every page reads but that rarely changes (settings, texts, the style list), so most page
// loads skip those database round-trips. Admin saves bust it on that instance; others refresh within the TTL.
type Entry = { at: number; ttl: number; value: Promise<unknown> };
const store = new Map<string, Entry>();

export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  const value = fn();
  store.set(key, { at: Date.now(), ttl: ttlMs, value });
  // A failed load is not cached.
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

/** Forget cached entries whose key starts with one of the prefixes. */
export function bust(...prefixes: string[]) {
  for (const k of [...store.keys()]) if (prefixes.some((p) => k.startsWith(p))) store.delete(k);
}
