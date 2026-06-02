import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {};

const pwaConfig = withPWA({
  dest: "public",
  customWorkerSrc: "worker",
  register: true,
  skipWaiting: true,
  // PWA (inclusiv offline) este dezactivat în dev – testează cu: npm run build && npm run start
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontendNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  extendDefaultRuntimeCaching: true,
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/_next\/static\//,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/mapa(\?.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "mapa-page",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "osm-tiles",
          expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "satellite-tiles",
          expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/foraj\/[^/]+\/?$/,
        handler: "CacheFirst",
        options: {
          cacheName: "foraj-pages",
          expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

export default pwaConfig(nextConfig);
