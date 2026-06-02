"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint } from "@/lib/types";
import { getCachedProfile } from "@/lib/offline-store";
import {
  getPointsForProjectOffline,
  savePointsForOffline,
  saveProfileForOffline,
} from "@/lib/offline-service";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { prefetchDrillPointDetails, getPointIdsMissingCache } from "@/lib/offline-prefetch";
import PointsDashboardTable from "./PointsDashboardTable";

const MapWithPoints = dynamic(() => import("./MapWithPoints"), { ssr: false });

interface MapViewProps {
  isAdmin?: boolean;
  projectId?: string;
  initialUserId?: string;
  initialTeamName?: string | null;
}

export default function MapView({
  isAdmin = false,
  projectId,
  initialUserId,
  initialTeamName,
}: MapViewProps) {
  const [points, setPoints] = useState<DrillPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const supabase = createClient();

  // Salvează userId (+ echipă) din server în cache la montare – ca „În lucru” / „Finalizat” să meargă offline
  useEffect(() => {
    if (!initialUserId) return;
    (async () => {
      const cached = await getCachedProfile();
      await saveProfileForOffline({
        userId: initialUserId,
        teamName: initialTeamName ?? cached?.teamName ?? null,
        isAdmin: cached?.isAdmin ?? isAdmin,
      });
    })();
  }, [initialUserId, initialTeamName, isAdmin]);

  const loadPoints = useCallback(async () => {
    if (!projectId) {
      setPoints([]);
      setLoading(false);
      return;
    }
    try {
      const query = supabase.from("drill_points").select("*").eq("project_id", projectId);
      const { data, error } = await query.order("code");
      if (error) throw error;
      const pts = data ?? [];
      setPoints(pts);
      setIsOffline(false);
      await savePointsForOffline(projectId, pts);
    } catch {
      const local = await getPointsForProjectOffline(projectId, isAdmin);
      if (local && local.length > 0) {
        setPoints(local);
        setIsOffline(true);
      } else {
        setPoints((prev) => (prev.length > 0 ? prev : []));
        setIsOffline(true);
      }
    }
    setLoading(false);
  }, [supabase, projectId, isAdmin]);

  useEffect(() => {
    loadPoints();
    const sub = supabase
      .channel("drill_points")
      .on("postgres_changes", { event: "*", schema: "public", table: "drill_points" }, loadPoints)
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, [loadPoints, supabase, isAdmin, projectId]);

  useNetworkStatus(loadPoints);

  // Prefetch automat: 2s după încărcarea punctelor, preîncarcă fișele în fundal
  const prefetchDoneRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!projectId || points.length === 0 || isOffline) return;
    const key = `${projectId}-${points.length}`;
    if (prefetchDoneRef.current.has(key)) return;
    const t = setTimeout(async () => {
      const ids = points.map((p) => p.id);
      const missing = await getPointIdsMissingCache(ids);
      if (missing.length === 0) return;
      prefetchDoneRef.current.add(key);
      prefetchDrillPointDetails(missing).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [projectId, points, isOffline]);

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Selectează un proiect din meniu.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Se încarcă harta...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2 p-2 min-h-0 overflow-hidden">
      <div className="shrink-0 flex justify-end">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600"
        >
          {showTable ? "Ascunde tabel" : "Arată tabel"}
        </button>
      </div>
      {showTable && (
        <div className="shrink-0 overflow-auto" style={{ maxHeight: "42vh" }}>
          <PointsDashboardTable
            points={points}
            variant="compact"
            linkToForaj={true}
            tableMaxHeight="28vh"
          />
        </div>
      )}
      <div className="flex-1 min-h-[200px] rounded-lg overflow-hidden">
        <MapWithPoints
          points={points}
          projectId={projectId}
          onRefresh={loadPoints}
          isAdmin={isAdmin}
          isOffline={isOffline}
          pointIds={points.map((p) => p.id)}
        />
      </div>
    </div>
  );
}
