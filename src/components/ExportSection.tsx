"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint } from "@/lib/types";
import type { Project } from "@/lib/types";
import type { CachedDrillPointDetail } from "@/lib/offline-store";
import { getPendingPhotos } from "@/lib/offline-store";
import {
  exportPdf,
  exportZip,
  exportPdfAsBlob,
  exportZipAsBlob,
  type ExportPhoto,
} from "@/lib/export-foraj";

const BUCKET = "borehole-photos";

interface ExportSectionProps {
  point: DrillPoint;
  project: Project | null;
  detail: CachedDrillPointDetail | null;
  isOffline?: boolean;
}

/** Web Share API – disponibil pe mobile (Share în WhatsApp, Salvare pe telefon etc.) */
const canUseShare = typeof navigator !== "undefined" && !!navigator.share;

export default function ExportSection({
  point,
  project,
  detail,
  isOffline = false,
}: ExportSectionProps) {
  const [exporting, setExporting] = useState<"pdf" | "zip" | "share-pdf" | "share-zip" | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function resolvePhotos(): Promise<ExportPhoto[]> {
    const result: ExportPhoto[] = [];

    const pending = await getPendingPhotos(point.id);
    for (const p of pending) {
      result.push({
        title: p.title,
        blob: p.blob,
        rotation: p.rotation,
      });
    }

    const boreholePhotos = detail?.boreholePhotos ?? [];
    if (boreholePhotos.length > 0 && !isOffline) {
      const supabase = createClient();
      for (const bp of boreholePhotos) {
        try {
          const { data } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(bp.storage_path);
          const res = await fetch(data.publicUrl);
          if (res.ok) {
            const blob = await res.blob();
            result.push({
              title: bp.title,
              blob,
              rotation: bp.rotation,
            });
          }
        } catch {
          // Skip failed fetches (e.g. CORS, network)
        }
      }
    }

    return result;
  }

  async function handleExportPdf() {
    setExporting("pdf");
    setMessage(null);
    try {
      const photos = await resolvePhotos();
      await exportPdf({
        point,
        project,
        detail,
        photos,
      });
      setMessage({ type: "success", text: "PDF descărcat cu succes." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Eroare la export PDF.",
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleExportZip() {
    setExporting("zip");
    setMessage(null);
    try {
      const photos = await resolvePhotos();
      await exportZip({
        point,
        project,
        detail,
        photos,
      });
      setMessage({ type: "success", text: "ZIP descărcat cu succes." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Eroare la export ZIP.",
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleSharePdf() {
    setExporting("share-pdf");
    setMessage(null);
    try {
      const photos = await resolvePhotos();
      const { blob, filename } = await exportPdfAsBlob({
        point,
        project,
        detail,
        photos,
      });
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Fișă foraj ${point.code}`,
          files: [file],
        });
        setMessage({ type: "success", text: "PDF partajat cu succes." });
      } else {
        await exportPdf({ point, project, detail, photos });
        setMessage({ type: "success", text: "Share indisponibil – PDF descărcat." });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setMessage({ type: "success", text: "Partajare anulată." });
      } else {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Eroare la partajare.",
        });
      }
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setExporting(null);
    }
  }

  async function handleShareZip() {
    setExporting("share-zip");
    setMessage(null);
    try {
      const photos = await resolvePhotos();
      const { blob, filename } = await exportZipAsBlob({
        point,
        project,
        detail,
        photos,
      });
      const file = new File([blob], filename, { type: "application/zip" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Foraj ${point.code} (ZIP)`,
          files: [file],
        });
        setMessage({ type: "success", text: "ZIP partajat cu succes." });
      } else {
        await exportZip({ point, project, detail, photos });
        setMessage({ type: "success", text: "Share indisponibil – ZIP descărcat." });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setMessage({ type: "success", text: "Partajare anulată." });
      } else {
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Eroare la partajare.",
        });
      }
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm p-4">
      <h2 className="font-semibold text-slate-800 mb-4">Export</h2>
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}
      <p className="text-sm text-slate-600 mb-4">
        {["DPSH", "DPM", "DPL", "DPH"].includes(point.tip_penetrare_dinamica ?? "") ? (
          <>Export PDF include Date foraj, tabelul și diagrama penetrării dinamice (N – adâncime), plus poze. ZIP conține: PDF, CSV cu intervalele de bătăi și folderul cu pozele.</>
        ) : (
          <>La finalul fișei poți exporta raportul PDF (conform șablonului Geologic Site), precum și un arhivă ZIP ce conține: folderul cu pozele denumite, fișa de foraj în PDF și CSV cu toate datele (Nume Proiect, Coordonate, Adâncime finală, etc.).</>
        )}
      </p>
      {canUseShare && (
        <p className="text-xs text-slate-500 mb-3">
          Share – partajare pe WhatsApp, Salvare pe telefon etc.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting !== null}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === "pdf" ? "Se generează..." : "Descarcă PDF"}
        </button>
        {canUseShare && (
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={exporting !== null}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === "share-pdf" ? "Se pregătește..." : "Share PDF"}
          </button>
        )}
        <button
          type="button"
          onClick={handleExportZip}
          disabled={exporting !== null}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === "zip" ? "Se generează..." : "Descarcă ZIP (Poze + PDF + CSV)"}
        </button>
        {canUseShare && (
          <button
            type="button"
            onClick={handleShareZip}
            disabled={exporting !== null}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting === "share-zip" ? "Se pregătește..." : "Share ZIP"}
          </button>
        )}
      </div>
    </section>
  );
}
