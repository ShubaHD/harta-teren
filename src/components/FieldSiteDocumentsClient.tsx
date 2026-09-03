"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint, FieldSiteFile } from "@/lib/types";
import { useIsAdminClient } from "@/hooks/useFieldSiteIndex";
import {
  deleteFieldSiteFile,
  downloadFromUrl,
  getFieldSitePublicUrl,
  isPdfFile,
  uploadFieldSitePdf,
} from "@/lib/field-site-files";

interface FieldSiteDocumentsClientProps {
  pointId: string;
}

export default function FieldSiteDocumentsClient({ pointId }: FieldSiteDocumentsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = useIsAdminClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [point, setPoint] = useState<DrillPoint | null>(null);
  const [pdf, setPdf] = useState<FieldSiteFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [{ data: pointRow, error: pointErr }, { data: fileRows, error: fileErr }] =
      await Promise.all([
        supabase.from("drill_points").select("*").eq("id", pointId).single(),
        supabase
          .from("field_site_files")
          .select("*")
          .eq("drill_point_id", pointId)
          .maybeSingle(),
      ]);
    if (pointErr || !pointRow) {
      setError("Forajul nu a fost găsit.");
      setLoading(false);
      return;
    }
    if (fileErr) {
      setError(
        "PDF-urile extra nu sunt disponibile. Rulează migrarea 026_field_site_files.sql în Supabase."
      );
      setPoint(pointRow as DrillPoint);
      setLoading(false);
      return;
    }
    setPoint(pointRow as DrillPoint);
    setPdf((fileRows as FieldSiteFile | null) ?? null);
    setLoading(false);
  }, [pointId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    if (!isPdfFile(file)) {
      setError("Selectează un fișier PDF.");
      return;
    }
    setUploading(true);
    setError(null);
    const { error: upErr } = await uploadFieldSitePdf(supabase, pointId, file);
    if (upErr) setError(upErr);
    await load();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete() {
    if (!pdf || !confirm(`Ștergi ${pdf.filename}?`)) return;
    setBusy(true);
    const { error: delErr } = await deleteFieldSiteFile(supabase, pdf);
    if (delErr) setError(delErr);
    await load();
    setBusy(false);
  }

  async function handleDownload() {
    if (!pdf) return;
    setBusy(true);
    try {
      await downloadFromUrl(getFieldSitePublicUrl(supabase, pdf.storage_path), pdf.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Descărcarea a eșuat.");
    }
    setBusy(false);
  }

  const pdfUrl = pdf ? getFieldSitePublicUrl(supabase, pdf.storage_path) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white border-b px-3 py-2.5 flex flex-wrap items-center gap-2 safe-area-left safe-area-right">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-slate-600 hover:text-slate-800 min-h-[44px] px-2 -ml-2"
        >
          ← Înapoi
        </button>
        <h1 className="font-semibold text-slate-800 text-sm sm:text-base truncate min-w-0">
          {point?.code ?? "Foraj"} — Fișă PDF
        </h1>
        {point && (
          <Link
            href={`/foraj/${point.id}`}
            className="text-xs text-blue-600 hover:underline ml-auto shrink-0"
          >
            Fișa aplicației
          </Link>
        )}
      </header>

      <main className="max-w-5xl mx-auto p-3 sm:p-4 space-y-4">
        {loading && <p className="text-sm text-slate-500">Se încarcă...</p>}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
        )}

        {isAdmin && (
          <div className="bg-white border rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {pdf ? "Înlocuiește PDF" : "Încarcă PDF"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
              className="block w-full text-sm text-slate-600"
            />
            {uploading && <p className="text-xs text-slate-500">Se încarcă...</p>}
          </div>
        )}

        {!loading && !pdf && (
          <p className="text-sm text-slate-500">Nu există fișă PDF pentru acest foraj.</p>
        )}

        {pdf && pdfUrl && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 min-h-[44px] inline-flex items-center bg-slate-800 text-white text-sm rounded-lg touch-manipulation"
              >
                Deschide PDF
              </a>
              <button
                type="button"
                onClick={handleDownload}
                disabled={busy}
                className="px-3 py-2 min-h-[44px] bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 touch-manipulation"
              >
                Descarcă PDF
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="px-3 py-2 min-h-[44px] text-red-600 text-sm rounded-lg border border-red-200 touch-manipulation"
                >
                  Șterge PDF
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">{pdf.filename}</p>
            <iframe
              src={pdfUrl}
              title={`Fișă ${point?.code ?? ""}`}
              className="w-full min-h-[70vh] bg-white border rounded-lg"
            />
          </div>
        )}
      </main>
    </div>
  );
}
