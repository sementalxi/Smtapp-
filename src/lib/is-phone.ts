/**
 * True on phones and tablets (iPhone, iPad, Android) — where "Save to Photos" opens the share sheet. Desktop
 * browsers (Windows / Mac Chrome and Edge also support sharing files) get a plain download instead.
 */
export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) return true;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports itself as a Mac
}
