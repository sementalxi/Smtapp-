import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/billing", "/profile", "/history", "/dashboard"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
