"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCsvContent, type ParsedDrillPoint } from "@/lib/csv-import";

interface CsvImportProps {
  projectId?: string;
  onImportComplete?: () => void;
}

export default function CsvImport({ projectId, onImportComplete }: CsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedDrillPoint[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setError(null);
    setSuccess(null);
    if (!f) {
      setFile(null);
      setParsed([]);
      return;
    }
    if (!f.name.endsWith(".csv")) {
      setError("Selectează un fișier CSV.");
      setFile(null);
      setParsed([]);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const points = parseCsvContent(text);
      setParsed(points);
      if (points.length === 0) {
        setError("Nu s-au găsit puncte în fișier. Verifică formatul: nr,n,e,h");
      }
    };
    reader.readAsText(f, "UTF-8");
  }

  async function handleImport() {
    if (parsed.length === 0) return;
    if (!projectId) {
      setError("Selectează un proiect pentru import.");
      return;
    }
    setError(null);
    setSuccess(null);
    setImporting(true);
    const supabase = createClient();

    const toInsert = parsed.map((p) => ({
      project_id: projectId,
      code: p.code,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes,
      status: "de_facut",
    }));

    const { data, error: insertError } = await supabase
      .from("drill_points")
      .upsert(toInsert, {
        onConflict: "project_id,code",
        ignoreDuplicates: true,
      })
      .select("id");

    setImporting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const inserted = data?.length ?? 0;
    const skipped = parsed.length - inserted;
    setSuccess(
      inserted > 0
        ? `Import reușit: ${inserted} puncte${skipped > 0 ? ` (${skipped} duplicate omise)` : ""}.`
        : "Toate punctele există deja."
    );
    setFile(null);
    setParsed([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onImportComplete?.();
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <h2 className="px-4 py-3 font-semibold text-slate-800 border-b">
        Import CSV
      </h2>
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-600">
          Format: <code className="bg-slate-100 px-1 rounded">nr,n,e,h</code> sau cu coloane opționale{" "}
          <code className="bg-slate-100 px-1 rounded">observatii,observatii2,observatii3</code>.
          Coordonate în DMS (ex: 44°37&apos;40&quot;N) sau grade zecimale.
          Fișiere Excel: salvează ca „CSV UTF-8” pentru simboluri corecte.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:cursor-pointer"
          />
          <button
            onClick={handleImport}
            disabled={parsed.length === 0 || importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Se importă..." : `Importă ${parsed.length > 0 ? `(${parsed.length} puncte)` : ""}`}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-600 bg-green-50 p-2 rounded">
            {success}
          </p>
        )}
        {parsed.length > 0 && (
          <div className="text-sm text-slate-500 max-h-32 overflow-y-auto">
            Preview: {parsed.slice(0, 5).map((p) => p.code).join(", ")}
            {parsed.length > 5 && ` ... +${parsed.length - 5} mai multe`}
          </div>
        )}
      </div>
    </section>
  );
}
