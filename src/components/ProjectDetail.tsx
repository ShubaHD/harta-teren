"use client";

import { useRouter } from "next/navigation";
import type { DrillPoint } from "@/lib/types";
import CsvImport from "./CsvImport";
import DeletePointButton from "./DeletePointButton";
import DeleteProjectButton from "./DeleteProjectButton";

interface Stats {
  total: number;
  de_facut: number;
  in_lucru: number;
  finalizat: number;
}

interface ProjectDetailProps {
  projectId: string;
  projectName: string;
  points: DrillPoint[];
  stats: Stats;
}

const STATUS_LABELS: Record<string, string> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  finalizat: "Finalizat",
};

export default function ProjectDetail({
  projectId,
  projectName,
  points,
  stats,
}: ProjectDetailProps) {
  const router = useRouter();

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
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={exportCsv}
          disabled={completed.length === 0}
          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Export CSV ({completed.length} foraje executate)
        </button>
        <DeleteProjectButton
          projectId={projectId}
          projectName={projectName}
          pointsCount={points.length}
          onDeleted={() => router.push("/admin/proiecte")}
        />
      </div>
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-slate-600">Total</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <p className="text-sm text-blue-700">De făcut</p>
          <p className="text-2xl font-bold text-blue-800">{stats.de_facut}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <p className="text-sm text-amber-700">În lucru</p>
          <p className="text-2xl font-bold text-amber-800">{stats.in_lucru}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <p className="text-sm text-green-700">Finalizat</p>
          <p className="text-2xl font-bold text-green-800">{stats.finalizat}</p>
        </div>
      </section>

      <CsvImport projectId={projectId} onImportComplete={() => router.refresh()} />

      <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <h2 className="px-4 py-3 font-semibold text-slate-800 border-b">
          Puncte ({points.length})
        </h2>
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Cod</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Status</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Echipă</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Adâncime finală</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Finalizat</th>
                <th className="px-4 py-2 text-right font-medium text-slate-700">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono">{p.code}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        p.status === "de_facut"
                          ? "bg-blue-100 text-blue-800"
                          : p.status === "in_lucru"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{p.assigned_team ?? "—"}</td>
                  <td className="px-4 py-2">{p.final_depth ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.completed_at
                      ? new Date(p.completed_at).toLocaleString("ro")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeletePointButton pointId={p.id} onDeleted={() => router.refresh()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
