"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint } from "@/lib/types";
import {
  fileRelativePath,
  isPdfFile,
  matchPathToPoint,
  uploadFieldSitePdf,
} from "@/lib/field-site-files";

interface FieldSiteBulkUploadProps {
  points: DrillPoint[];
}

export default function FieldSiteBulkUpload({ points }: FieldSiteBulkUploadProps) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const files = Array.from(list).filter(isPdfFile);
    let ok = 0;
    let unmatched = 0;
    let failed = 0;
    const unmatchedNames: string[] = [];
    const matched: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Se încarcă ${i + 1}/${files.length}…`);
      const path = fileRelativePath(file);
      const point = matchPathToPoint(path, points);
      if (!point) {
        unmatched++;
        if (unmatchedNames.length < 8) unmatchedNames.push(path);
        continue;
      }
      const { error } = await uploadFieldSitePdf(supabase, point.id, file);
      if (error) failed++;
      else {
        ok++;
        if (matched.length < 6) matched.push(`${file.name} → ${point.code}`);
      }
    }

    const extras = [
      matched.length > 0 ? ` ${matched.join("; ")}${ok > matched.length ? "…" : ""}` : "",
      unmatchedNames.length > 0
        ? ` Nepotrivite: ${unmatchedNames.join(", ")}${unmatched > unmatchedNames.length ? "…" : ""}`
        : "",
    ].join("");
    setMessage({
      type: failed > 0 || unmatched > 0 ? "error" : "success",
      text: `Încărcate: ${ok}. Fără foraj potrivit: ${unmatched}. Erori: ${failed}.${extras}`,
    });
    setProgress("");
    setBusy(false);
    if (pdfRef.current) pdfRef.current.value = "";
  }

  return (
    <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <h2 className="px-4 py-3 font-semibold text-slate-800 border-b">Încarcă fișe PDF</h2>
      <div className="p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Un PDF per foraj. <code className="bg-slate-100 px-1 rounded">Foraj_FI_64+880.pdf</code> se
          leagă de forajul <code className="bg-slate-100 px-1 rounded">FI64+880</code> — underscore-ul
          se ignoră. Nu redenumi PDF-urile.
        </p>
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busy || points.length === 0}
          onChange={(e) => handleFiles(e.target.files)}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer"
        />
        {busy && <p className="text-sm text-slate-500">{progress || "Se încarcă..."}</p>}
        {message && (
          <p
            className={`text-sm rounded-lg p-2 ${
              message.type === "error"
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-green-50 text-green-800 border border-green-200"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
