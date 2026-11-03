import type { MetadataRoute } from "next";

/** Lets people "Add to Home Screen" (needed on iPhone for notifications). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KIXO — AI sports posters",
    short_name: "KIXO",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0710",
    theme_color: "#0b0710",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
