"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  parseCsvContent,
  findExistingPointByCode,
  normalizeDrillPointCode,
  type ParsedDrillPoint,
} from "@/lib/csv-import";

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
        setError("Nu s-au găsit puncte în fișier. Verifică formatul: nr,n,e,z,h,Echipare1,Echipare2,Observatii,Prioritate");
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

    type CsvFields = {
      project_id: string;
      code: string;
      lat: number;
      lng: number;
      notes: string | null;
      kilometraj: string | null;
      elevation_h: string | null;
      adancime_propusa: string | null;
      echipare1: string | null;
      echipare2: string | null;
      prioritate: string | null;
      pressuremeter_test: string | null;
    };

    const toFields = (p: ParsedDrillPoint): CsvFields => ({
      project_id: projectId,
      code: p.code,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes,
      kilometraj: p.kilometraj?.trim() || null,
      elevation_h: p.elevation_h?.trim() || null,
      adancime_propusa: p.adancime_propusa?.trim() || null,
      echipare1: p.echipare1?.trim() || null,
      echipare2: p.echipare2?.trim() || null,
      prioritate: p.prioritate,
      pressuremeter_test: p.pressuremeter_test?.trim() || null,
    });

    const byNorm = new Map<string, CsvFields>();
    for (const p of parsed) {
      byNorm.set(normalizeDrillPointCode(p.code), toFields(p));
    }
    const uniqueCsv = Array.from(byNorm.values());

    const { data: existing, error: loadError } = await supabase
      .from("drill_points")
      .select("id, code")
      .eq("project_id", projectId);

    if (loadError) {
      setImporting(false);
      setError(loadError.message);
      return;
    }

    const existingPoints = existing ?? [];
    const usedIds = new Set<string>();
    const toUpdate: (CsvFields & { id: string; updated_at: string })[] = [];
    const toInsert: CsvFields[] = [];

    for (const row of uniqueCsv) {
      const match = findExistingPointByCode(existingPoints, row.code, usedIds);
      if (match) {
        usedIds.add(match.id);
        toUpdate.push({
          ...row,
          id: match.id,
          updated_at: new Date().toISOString(),
        });
      } else {
        toInsert.push(row);
      }
    }

    const fail = (msg: string) => {
      setImporting(false);
      if (/echipare1|echipare2|prioritate|pressuremeter_test/i.test(msg)) {
        setError(
          "Lipsește o coloană în baza de date. În Supabase → SQL Editor rulează: ALTER TABLE drill_points ADD COLUMN IF NOT EXISTS pressuremeter_test TEXT;"
        );
      } else {
        setError(msg);
      }
    };

    if (toUpdate.length > 0) {
      for (const u of toUpdate) {
        const { id, project_id: _projectId, ...fields } = u;
        const { error: updateError } = await supabase
          .from("drill_points")
          .update(fields)
          .eq("id", id);
        if (updateError) {
          fail(updateError.message);
          return;
        }
      }
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase.from("drill_points").insert(toInsert);
      if (insertError) {
        fail(insertError.message);
        return;
      }
    }

    setImporting(false);
    const renamed = toUpdate.filter((u) => {
      const old = existingPoints.find((e) => e.id === u.id);
      return old != null && old.code !== u.code;
    }).length;
    const duplicateCount = parsed.length - uniqueCsv.length;
    const parts = [`Import reușit: ${toUpdate.length} actualizate, ${toInsert.length} noi.`];
    if (renamed > 0) {
      parts.push(`${renamed} redenumite (ex. FI_61+120 → Fi61+120). Statusul și fișa rămân.`);
    }
    if (duplicateCount > 0) {
      parts.push(`(${duplicateCount} coduri duplicate din CSV au fost ignorate)`);
    }
    setSuccess(parts.join(" "));
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
          Format: <code className="bg-slate-100 px-1 rounded">nr.,n,e,z,h,Echipare1,Echipare2,Observatii,Prioritate,Pressuremeter Test</code>.
          Coloana <strong>h</strong> = adâncime propusă, <strong>z</strong> = cotă, <strong>Prioritate</strong> = 1, 2 sau 3.
          Rămâne valid și formatul vechi <code className="bg-slate-100 px-1 rounded">nr,n,e,h</code> (+ km, observații).
          Coordonate în DMS (ex: 44°37&apos;40&quot;N) sau grade zecimale.
          Fișiere Excel: salvează ca „CSV UTF-8” pentru simboluri corecte.
        </p>
        <p className="text-xs text-slate-500">
          Total puncte în Dashboard = puncte unice per proiect (per cod <code className="bg-slate-100 px-0.5">nr</code>). 
          Dacă același CSV dă totaluri diferite la două proiecte, verifică că ambele au fost importate cu același fișier; 
          rândurile cu cod duplicat în CSV sunt omise. <code className="bg-slate-100 px-0.5">Fi61+120</code> se potrivește cu <code className="bg-slate-100 px-0.5">FI_61+120</code>: se actualizează forajul existent (inclusiv numele), fără să se piardă În lucru / Finalizat sau fișa.
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
