"use client";

import { useState } from "react";
import {
  prefetchDrillPointDetails,
  getPointIdsMissingCache,
  type PrefetchProgress,
} from "@/lib/offline-prefetch";

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
  const [prefetching, setPrefetching] = useState(false);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePrefetch() {
    if (pointIds.length === 0) {
      setMessage("Nu există puncte de preîncărcat.");
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
        setMessage(`Toate cele ${pointIds.length} fișe sunt deja în cache.`);
        setPrefetching(false);
        setProgress(null);
        setTimeout(() => setMessage(null), 4000);
        return;
      }
      const { done, failed } = await prefetchDrillPointDetails(missing, setProgress);
      setMessage(
        `Gata: ${done} fișe preîncărcate${failed > 0 ? `, ${failed} eșecuri` : ""}. Fișele se vor deschide offline fără să le mai deschizi una câte una.`
      );
    } catch (e) {
      setMessage("Eroare la preîncărcare. Verifică conexiunea.");
    }
    setPrefetching(false);
    setProgress(null);
    setTimeout(() => setMessage(null), 5000);
  }

  const toFetch = pointIds.length;
  const label = prefetching
    ? progress
      ? `Se încarcă... ${progress.done + progress.failed}/${progress.total}`
      : "Se încarcă..."
    : `Pregătește offline (${toFetch})`;

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
        title={`Pregătește ${toFetch} fișe pentru utilizare offline`}
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
