import type { MetadataRoute } from "next";

/** Conținut manifest PWA – servit via app/manifest.webmanifest/route.ts */
export const manifestData: MetadataRoute.Manifest = {
  id: "/",
  name: "Harta Teren - Puncte de Foraj",
  short_name: "Harta Teren",
  description: "Puncte de foraj pe teren. Funcționează offline după pregătire – pentru lucru în câmp.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  background_color: "#f8fafc",
  theme_color: "#1e293b",
  orientation: "any",
  categories: ["productivity", "utilities"],
  prefer_related_applications: false,
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
