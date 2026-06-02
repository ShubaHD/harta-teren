/**
 * Central logger for offline-first: SW fetch, cache, IndexedDB, sync.
 * All modules use this for consistent [Offline] prefixed logs.
 */

const PREFIX = "[Offline]";
const MAX_RECENT = 100;

export type LogCategory = "sw:fetch" | "sw:cacheHit" | "sw:cacheMiss" | "idb:write" | "sync:retry" | "sync:result" | "status:change" | "status:probe";

export interface LogEntry {
  ts: number;
  category: LogCategory;
  message: string;
  detail?: unknown;
}

const recent: LogEntry[] = [];

function capture(entry: LogEntry) {
  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.shift();
}

function enabled(): boolean {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return typeof window !== "undefined" && (window as unknown as { __OFFLINE_DEBUG?: boolean }).__OFFLINE_DEBUG === true;
  }
  return true;
}

export function log(category: LogCategory, message: string, detail?: unknown): void {
  const entry: LogEntry = { ts: Date.now(), category, message, detail };
  capture(entry);
  if (!enabled()) return;
  const detailStr = detail !== undefined ? ` ${JSON.stringify(detail)}` : "";
  console.log(`${PREFIX} [${category}] ${message}${detailStr}`);
}

export function getRecentLogs(): LogEntry[] {
  return [...recent];
}

export function clearRecentLogs(): void {
  recent.length = 0;
}
