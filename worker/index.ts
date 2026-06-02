/**
 * Custom service worker code injected by next-pwa.
 * Logs fetch events. Cache hit/miss is determined by workbox; check DevTools > Application > Cache Storage.
 */

const PREFIX = "[Offline] [sw:fetch]";

interface FetchEventLike extends Event {
  request: Request;
}

self.addEventListener("fetch", (event: Event) => {
  const ev = event as FetchEventLike;
  const url = ev.request.url;
  const mode = ev.request.mode;
  try {
    const u = new URL(url);
    if (self.location.origin !== u.origin) return;
  } catch {
    return;
  }
  if (mode === "navigate" || ev.request.destination === "document") {
    console.log(`${PREFIX} document ${url}`);
  } else if (mode === "same-origin") {
    console.log(`${PREFIX} same-origin ${url}`);
  }
});
