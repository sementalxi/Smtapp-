import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
