"use client";

import { useState } from "react";
import {
  prefetchDrillPointDetails,
  getPointIdsMissingCache,
  type PrefetchProgress,
} from "@/lib/offline-prefetch";
import { useI18n } from "./I18nProvider";

interface PrefetchOfflineButtonProps {
  pointIds: string[];
  projectId?: string;
  disabled?: boolean;
}

/** Încălzește cache-ul SW pentru pagina hărții, ca „Înapoi la hartă” să meargă offline. */
async function warmMapPageCache(projectId?: string): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const origin = window.location.origin;
  const urls = [origin + "/mapa", projectId ? origin + `/mapa?project=${projectId}` : null].filter(Boolean) as string[];
  const opts: RequestInit = { credentials: "include", mode: "same-origin" };
  await Promise.all(urls.map((url) => fetch(url, opts).catch(() => null)));
}

export default function PrefetchOfflineButton({ pointIds, projectId, disabled }: PrefetchOfflineButtonProps) {
  const { t } = useI18n();
  const [prefetching, setPrefetching] = useState(false);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePrefetch() {
    if (pointIds.length === 0) {
      setMessage(t("offline.none"));
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setPrefetching(true);
    setProgress({ total: pointIds.length, done: 0, failed: 0 });
    setMessage(null);
    try {
      await warmMapPageCache(projectId);
      const missing = await getPointIdsMissingCache(pointIds);
      if (missing.length === 0) {
        setMessage(t("offline.allCached", { n: pointIds.length }));
        setPrefetching(false);
        setProgress(null);
        setTimeout(() => setMessage(null), 4000);
        return;
      }
      const { done, failed } = await prefetchDrillPointDetails(missing, setProgress);
      setMessage(
        failed > 0
          ? t("offline.doneFail", { done, failed })
          : t("offline.doneOk", { done })
      );
    } catch {
      setMessage(t("offline.error"));
    }
    setPrefetching(false);
    setProgress(null);
    setTimeout(() => setMessage(null), 5000);
  }

  const toFetch = pointIds.length;
  const label = prefetching
    ? progress
      ? t("offline.progress", { done: progress.done + progress.failed, total: progress.total })
      : t("offline.loading")
    : t("offline.prepare", { n: toFetch });

  const shortLabel = prefetching && progress
    ? `${progress.done + progress.failed}/${progress.total}`
    : prefetching
      ? "..."
      : toFetch > 0
        ? `Offline (${toFetch})`
        : "Offline";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handlePrefetch}
        disabled={disabled || prefetching || toFetch === 0}
        title={t("offline.prepareTitle", { n: toFetch })}
        className="px-2 py-1 bg-slate-700 text-white text-[11px] sm:text-xs rounded-md font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow touch-manipulation whitespace-nowrap"
      >
        <span className="sm:hidden">📥 {shortLabel}</span>
        <span className="hidden sm:inline">📥 {label}</span>
      </button>
      {progress && prefetching && (
        <div className="w-24 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${progress.total ? ((progress.done + progress.failed) / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      )}
      {message && (
        <p className="text-[10px] sm:text-xs text-slate-600 max-w-[160px] text-right">{message}</p>
      )}
    </div>
  );
}
