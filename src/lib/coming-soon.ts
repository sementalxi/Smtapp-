// Admin → Settings → Categories: anything marked "Coming soon" shows to players with a badge but can't be used yet
// (staff can still open it to test).
import { getSettings } from "./settings";

export const EXTRA_CATEGORIES = ["LOGO_MAKER", "STREAM_KIT"] as const;

export async function comingSoonList(): Promise<string[]> {
  return ((await getSettings()).coming_soon ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

export async function isComingSoon(key: string): Promise<boolean> {
  return (await comingSoonList()).includes(key);
}
