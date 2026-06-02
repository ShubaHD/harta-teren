"use client";

import { useState } from "react";
import type { DrillPoint } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  finalizat: "Finalizat",
};

export interface PointsDashboardTableStats {
  total: number;
  de_facut: number;
  in_lucru: number;
  finalizat: number;
}

function computeStats(points: DrillPoint[]): PointsDashboardTableStats {
  return {
    total: points.length,
    de_facut: points.filter((p) => p.status === "de_facut").length,
    in_lucru: points.filter((p) => p.status === "in_lucru").length,
    finalizat: points.filter((p) => p.status === "finalizat").length,
  };
}

interface PointsDashboardTableProps {
  points: DrillPoint[];
  /** Dacă nu e dat, se calculează din points */
  stats?: PointsDashboardTableStats;
  /** "compact" = mai puțin padding, pentru spațiu redus */
  variant?: "default" | "compact";
  /** Link la fișa foraj pentru cod. false = doar text */
  linkToForaj?: boolean;
  /** Render custom pentru coloana Acțiuni. Dacă lipsește, nu se afișează coloana */
  renderActions?: (point: DrillPoint) => React.ReactNode;
  /** Înălțime maximă tabel (ex: "40vh"). Default "50vh" */
  tableMaxHeight?: string;
  /** Titlu secțiune */
  title?: string;
}

export default function PointsDashboardTable({
  points,
  stats: statsProp,
  variant = "default",
  linkToForaj = false,
  renderActions,
  tableMaxHeight = "50vh",
  title = "Puncte",
}: PointsDashboardTableProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "in_lucru" | "finalizat">("all");

  const stats = statsProp ?? computeStats(points);
  const filteredPoints =
    statusFilter === "all"
      ? points
      : points.filter((p) => p.status === statusFilter);

  const isCompact = variant === "compact";
  const cardP = isCompact ? "p-3" : "p-4";
  const cardText = isCompact ? "text-lg" : "text-2xl";

  return (
    <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Dashboard */}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${cardP}`}>
        <div className="bg-slate-50 rounded-lg border p-3">
          <p className="text-sm text-slate-600">Total</p>
          <p className={`font-bold text-slate-800 ${cardText}`}>{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
          <p className="text-sm text-blue-700">De făcut</p>
          <p className={`font-bold text-blue-800 ${cardText}`}>{stats.de_facut}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
          <p className="text-sm text-amber-700">În lucru</p>
          <p className={`font-bold text-amber-800 ${cardText}`}>{stats.in_lucru}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-3">
          <p className="text-sm text-green-700">Finalizat</p>
          <p className={`font-bold text-green-800 ${cardText}`}>{stats.finalizat}</p>
        </div>
      </div>

      {/* Tabel cu filtru */}
      <div className="border-t">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">
            {title} ({filteredPoints.length}
            {statusFilter !== "all" && ` / ${points.length}`})
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Filtru:</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "in_lucru" | "finalizat")
              }
              className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">Toate</option>
              <option value="in_lucru">În lucru</option>
              <option value="finalizat">Finalizate</option>
            </select>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: tableMaxHeight }}>
          {filteredPoints.length === 0 ? (
            <p className="px-4 py-8 text-center text-slate-500 text-sm">
              Niciun punct după filtrare.
            </p>
          ) : (
          <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Cod</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Echipă</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Adâncime finală</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Finalizat</th>
                  {renderActions && (
                    <th className="px-4 py-2 text-right font-medium text-slate-700">Acțiuni</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPoints.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2">
                      {linkToForaj ? (
                        <a
                          href={`/foraj/${p.id}`}
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {p.code}
                        </a>
                      ) : (
                        <span className="font-mono text-slate-800">{p.code}</span>
                      )}
                    </td>
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
                    {renderActions && (
                      <td className="px-4 py-2 text-right">
                        {renderActions(p)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
