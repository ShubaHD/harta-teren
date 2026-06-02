"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DrillPoint, Project } from "@/lib/types";
import CsvImport from "./CsvImport";
import DeletePointButton from "./DeletePointButton";
import DeleteProjectButton from "./DeleteProjectButton";
import ResetPointStatusButton from "./ResetPointStatusButton";
import PointsDashboardTable from "./PointsDashboardTable";
import PipelineGeoJsonImport from "./PipelineGeoJsonImport";
import { fetchAndCacheDrillPointDetail } from "@/lib/offline-form-sync";
import { resolvePhotosForExport } from "@/lib/resolve-export-photos";
import { exportZipAsBlob, addForajToZip } from "@/lib/export-foraj";
import JSZip from "jszip";

interface Stats {
  total: number;
  de_facut: number;
  in_lucru: number;
  finalizat: number;
}

interface ProjectDetailProps {
  projectId: string;
  project: Project;
  points: DrillPoint[];
  stats: Stats;
}

function sanitizeForFile(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

export default function ProjectDetail({
  projectId,
  project,
  points,
  stats,
}: ProjectDetailProps) {
  const router = useRouter();
  const projectName = project.name;
  const [generatingPointId, setGeneratingPointId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const completed = points.filter((p) => p.status === "finalizat");

  async function handleGenerateZipForPoint(point: DrillPoint) {
    setGeneratingPointId(point.id);
    setZipError(null);
    try {
      const detail = await fetchAndCacheDrillPointDetail(point.id);
      const photos = await resolvePhotosForExport(
        point.id,
        detail?.boreholePhotos ?? []
      );
      const { blob, filename } = await exportZipAsBlob({
        point: detail?.point ?? point,
        project,
        detail,
        photos,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Eroare la generare ZIP");
    } finally {
      setGeneratingPointId(null);
    }
  }

  async function handleGenerateZipForAll() {
    if (completed.length === 0) return;
    setGeneratingAll(true);
    setZipError(null);
    try {
      const zip = new JSZip();
      const folderName = sanitizeForFile(`${projectName}_ToateForajele`);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, "")
        .slice(0, 12);

      for (const point of completed) {
        const detail = await fetchAndCacheDrillPointDetail(point.id);
        const photos = await resolvePhotosForExport(
          point.id,
          detail?.boreholePhotos ?? []
        );
        const subfolderName = sanitizeForFile(`Foraj_${point.code}`);
        await addForajToZip(
          zip,
          {
            point: detail?.point ?? point,
            project,
            detail,
            photos,
          },
          subfolderName,
          { bundleMode: true }
        );
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const filename = `${folderName}_${timestamp}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Eroare la generare ZIP");
    } finally {
      setGeneratingAll(false);
    }
  }

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
    a.download = `foraje-executate-${projectName.replace(/\s+/g, "-").replace(/[<>:"/\\|?*]/g, "_")}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {zipError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {zipError}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={exportCsv}
          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Export CSV ({completed.length} foraje executate)
        </button>
        <button
          onClick={handleGenerateZipForAll}
          disabled={generatingAll || completed.length === 0}
          title={completed.length === 0 ? "Adaugă foraje finalizate pentru a genera ZIP" : undefined}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shrink-0"
        >
          {generatingAll ? "Se generează..." : `Generează ZIP pentru toate (${completed.length})`}
        </button>
        <DeleteProjectButton
          projectId={projectId}
          projectName={projectName}
          pointsCount={points.length}
          onDeleted={() => router.push("/admin/proiecte")}
        />
      </div>
      <CsvImport projectId={projectId} onImportComplete={() => router.refresh()} />
      <PipelineGeoJsonImport
        projectId={projectId}
        onImportComplete={() => router.refresh()}
      />

      <PointsDashboardTable
        points={points}
        stats={stats}
        linkToForaj={true}
        tableMaxHeight="50vh"
        renderActions={(p) => (
          <span className="inline-flex items-center gap-1 flex-wrap justify-end">
            {p.status === "finalizat" && (
              <button
                type="button"
                onClick={() => handleGenerateZipForPoint(p)}
                disabled={generatingPointId !== null}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPointId === p.id ? "..." : "Generează ZIP"}
              </button>
            )}
            {p.status !== "de_facut" && (
              <ResetPointStatusButton
                pointId={p.id}
                pointCode={p.code}
                onReset={() => router.refresh()}
              />
            )}
            <DeletePointButton pointId={p.id} onDeleted={() => router.refresh()} />
          </span>
        )}
      />
    </div>
  );
}
