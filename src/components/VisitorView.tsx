"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { DrillPoint } from "@/lib/types";

const VisitorMap = dynamic(() => import("./VisitorMap"), { ssr: false });

interface VisitorViewProps {
  projectId: string;
  projectName: string;
  points: DrillPoint[];
}

export default function VisitorView({ projectId, projectName, points: initialPoints }: VisitorViewProps) {
  const [points, setPoints] = useState(initialPoints);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/vizitatori/${projectId}`);
      if (res.ok) {
        const { points: fresh } = await res.json();
        setPoints(fresh);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  const completed = points.filter((p) => p.status === "finalizat");

  function exportCsv() {
    const rows = [
      ["code", "lat", "lng", "status", "echipa", "adancime_finala", "finalizat_la"],
      ...completed.map((p) => [
        p.code,
        p.lat,
        p.lng,
        p.status,
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
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b shrink-0">
        <h1 className="font-semibold text-slate-800">{projectName} — Vizitatori</h1>
        <button
          onClick={exportCsv}
          disabled={completed.length === 0}
          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV ({completed.length} foraje executate)
        </button>
      </header>
      <main className="flex-1 min-h-[300px]">
        <VisitorMap points={points} projectId={projectId} />
      </main>
    </div>
  );
}
