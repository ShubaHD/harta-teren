"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { DrillPoint } from "@/lib/types";
import { cachePoints, getCachedPoints } from "@/lib/offline-store";
import PointsDashboardTable from "./PointsDashboardTable";

const VisitorMap = dynamic(() => import("./VisitorMap"), { ssr: false });

interface VisitorViewProps {
  projectId: string;
  project: { name: string; topic?: string | null; location?: string | null; client?: string | null };
  points: DrillPoint[];
}

export default function VisitorView({ projectId, project, points: initialPoints }: VisitorViewProps) {
  const projectName = project.name;
  const [points, setPoints] = useState(initialPoints);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    cachePoints(projectId, initialPoints);
  }, [projectId, initialPoints]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/vizitatori/${projectId}`);
        if (res.ok) {
          const { points: fresh } = await res.json();
          setPoints(fresh);
          await cachePoints(projectId, fresh);
        }
      } catch {
        const cached = await getCachedPoints(projectId);
        if (cached) setPoints(cached);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const completed = points.filter((p) => p.status === "finalizat");

  function exportCsv() {
    const esc = (v: string | null | undefined) =>
      String(v ?? "").includes(",") ? `"${String(v ?? "").replace(/"/g, '""')}"` : String(v ?? "");
    const rows = [
      ["Nume proiect", esc(projectName)],
      ["Beneficiar", esc(project.client)],
      ["Tema", esc(project.topic)],
      ["Locatie", esc(project.location)],
      [] as string[],
      ["code", "lat", "lng", "status", "echipa", "adancime_finala", "finalizat_la"],
      ...completed.map((p) => [
        String(p.code),
        String(p.lat),
        String(p.lng),
        String(p.status),
        p.assigned_team ?? "",
        p.final_depth ?? "",
        p.completed_at ? new Date(p.completed_at).toISOString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foraje-executate-${projectName.replace(/\s+/g, "-")}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen app-fullscreen flex flex-col bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-white border-b shrink-0 safe-area-left safe-area-right">
        <h1 className="font-semibold text-slate-800 text-sm sm:text-base truncate min-w-0 max-w-[50%] sm:max-w-none" title={`${projectName} — Vizitatori`}>
          {projectName} — Vizitatori
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 shrink-0"
          >
            {showTable ? "Ascunde tabel" : "Arată tabel"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs sm:text-sm px-3 py-2 min-h-[44px] inline-flex items-center bg-green-600 text-white rounded-lg hover:bg-green-700 shrink-0 whitespace-nowrap touch-manipulation"
          >
            Export CSV ({completed.length})
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col p-3 gap-3 overflow-hidden">
        {showTable && (
          <div className="shrink-0 overflow-auto" style={{ maxHeight: "45vh" }}>
            <PointsDashboardTable
              points={points}
              variant="compact"
              linkToForaj={false}
              tableMaxHeight="30vh"
            />
          </div>
        )}
        <div className="flex-1 min-h-[250px] rounded-lg overflow-hidden border bg-white shrink-0">
          <VisitorMap points={points} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
