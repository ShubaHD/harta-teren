"use client";

import { useState } from "react";
import type { DrillPoint } from "@/lib/types";
import { getTileUrlsInBounds, precacheTileUrls } from "@/lib/precache-tiles";

interface DownloadMapButtonProps {
  points: DrillPoint[];
}

export default function DownloadMapButton({ points }: DownloadMapButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  if (points.length < 2) return null;

  async function handleClick() {
    const lats = points.map((p) => Number(p.lat));
    const lngs = points.map((p) => Number(p.lng));
    const minLat = Math.min(...lats) - 0.01;
    const maxLat = Math.max(...lats) + 0.01;
    const minLng = Math.min(...lngs) - 0.01;
    const maxLng = Math.max(...lngs) + 0.01;

    const urls = getTileUrlsInBounds(minLat, maxLat, minLng, maxLng, [12, 13, 14]);
    setLoading(true);
    setProgress({ done: 0, total: urls.length });

    try {
      await precacheTileUrls(urls, (done, total) => setProgress({ done, total }));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-[11px] sm:text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 disabled:opacity-50 touch-manipulation whitespace-nowrap flex items-center"
        title="Încarcă tile-urile hărții pentru mod offline"
      >
        {loading && progress
          ? `Se descarcă... ${progress.done}/${progress.total}`
          : "📥 Hartă offline"}
      </button>
      {loading && (
        <div className="w-20 h-1 bg-slate-200 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{
              width: progress ? `${(progress.done / progress.total) * 100}%` : "0%",
            }}
          />
        </div>
      )}
    </div>
  );
}
