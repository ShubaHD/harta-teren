"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint } from "@/lib/types";

const MapWithPoints = dynamic(() => import("./MapWithPoints"), { ssr: false });

interface MapViewProps {
  isAdmin?: boolean;
  projectId?: string;
}

export default function MapView({ isAdmin = false, projectId }: MapViewProps) {
  const [points, setPoints] = useState<DrillPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadPoints = useCallback(async () => {
    if (!projectId) {
      setPoints([]);
      setLoading(false);
      return;
    }
    let query = supabase.from("drill_points").select("*").eq("project_id", projectId);
    if (!isAdmin) {
      query = query.in("status", ["de_facut", "in_lucru"]);
    }
    const { data, error } = await query.order("code");
    if (error) {
      console.error(error);
      setPoints([]);
    } else {
      setPoints(data ?? []);
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
    <MapWithPoints
      points={points}
      projectId={projectId}
      onRefresh={loadPoints}
      isAdmin={isAdmin}
    />
  );
}
