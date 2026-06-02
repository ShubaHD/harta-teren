"use client";

/**
 * Connectivity status that does not rely only on navigator.onLine.
 * Uses navigator.onLine as fast hint + periodic probe (HEAD request) to confirm.
 */

import { log } from "./offlineLogger";
import { processQueueWithRetry } from "./syncQueue";

const PROBE_URL = "/api/health";
const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 5000;

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

let cachedOnline = true;
let probeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Probe: try a small fetch. Does not rely on navigator.onLine.
 */
async function probe(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(PROBE_URL, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const ok = res.ok;
    log("status:probe", ok ? "probe OK" : "probe failed", { status: res.status });
    return ok;
  } catch (e) {
    log("status:probe", "probe error", { error: String(e) });
    return false;
  }
}

function setOnline(online: boolean) {
  if (cachedOnline === online) return;
  cachedOnline = online;
  log("status:change", online ? "online" : "offline", { navigatorOnLine: typeof navigator !== "undefined" ? navigator.onLine : undefined });
  listeners.forEach((cb) => cb(online));
  if (online) {
    processQueueWithRetry().catch(() => { });
  }
}

function tick() {
  probe().then(setOnline);
}

/**
 * Start status checks: use navigator.onLine first, then run probe periodically.
 * When navigator says offline, set offline immediately; when it says online, confirm with one probe.
 */
export function start(): void {
  if (typeof window === "undefined") return;
  const navOnline = navigator.onLine;
  if (!navOnline) {
    setOnline(false);
  } else {
    probe().then((ok) => setOnline(ok));
  }

  window.addEventListener("online", () => {
    log("status:change", "navigator.onLine true, probing", {});
    probe().then(setOnline);
  });
  window.addEventListener("offline", () => {
    setOnline(false);
  });

  if (!probeTimer) {
    probeTimer = setInterval(tick, PROBE_INTERVAL_MS);
  }
}

export function stop(): void {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  listeners.clear();
}

/**
 * Current online status (cached; updated by navigator + probe).
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return cachedOnline;
}

/**
 * Subscribe to online/offline changes.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(cachedOnline);
  return () => listeners.delete(listener);
}
