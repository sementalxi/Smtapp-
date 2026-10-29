import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploaded photos can be large; server actions are not used for uploads,
  // but keep a generous limit just in case.
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
