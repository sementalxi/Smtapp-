/** URL of a resized WebP preview for one of our stored images (falls back to the original). */
export function thumb(url: string | null | undefined, width = 480): string {
  if (!url) return "";
  if (url.startsWith("/api/files/") || url.includes(".blob.vercel-storage.com") || url.includes("amazonaws.com") || url.includes("r2.")) {
    return `/api/thumb?w=${width}&u=${encodeURIComponent(url)}`;
  }
  return url;
}
