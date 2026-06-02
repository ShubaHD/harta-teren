"use client";

import { useState } from "react";

interface Project {
  id: string;
  name: string;
}

interface AdminExportClientProps {
  projects: Project[];
}

export default function AdminExportClient({ projects }: AdminExportClientProps) {
  const [selectedId, setSelectedId] = useState<string>(projects[0]?.id ?? "");

  const downloadCsvImport = () => {
    if (!selectedId) return;
    window.open(`/api/admin/export/csv-import?projectId=${encodeURIComponent(selectedId)}`, "_blank");
  };

  const downloadSituatie = () => {
    if (!selectedId) return;
    window.open(`/api/admin/export/situatie?projectId=${encodeURIComponent(selectedId)}`, "_blank");
  };

  const downloadRaportare = () => {
    if (!selectedId) return;
    window.open(`/api/admin/export/raportare?projectId=${encodeURIComponent(selectedId)}`, "_blank");
  };

  if (projects.length === 0) {
    return (
      <p className="text-slate-500">Nu există proiecte. Creează un proiect din Proiecte.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">Proiect</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-800 bg-white"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">CSV format import</h2>
        <p className="text-sm text-slate-600">
          Descarcă punctele proiectului în același format ca la upload: <code className="bg-slate-100 px-1 rounded">nr,n,e,h,km,observatii</code>.
          Poți folosi fișierul pentru arhivă sau re-import în alt proiect.
        </p>
        <button
          type="button"
          onClick={downloadCsvImport}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium"
        >
          Descarcă CSV format import
        </button>
      </section>

      <section className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">CSV situație actuală (foraje finalizate)</h2>
        <p className="text-sm text-slate-600">
          Descarcă forajele finalizate cu cod, coordonate, echipă, adâncime, <strong>data în lucru</strong> (când s-a apăsat „În lucru”) și <strong>finalizat</strong> (doar data, ZZ-LL-AAAA).
        </p>
        <button
          type="button"
          onClick={downloadSituatie}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Descarcă CSV situație actuală
        </button>
      </section>

      <section className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-slate-800">Raportare anuală foraje</h2>
        <p className="text-sm text-slate-600">
          Generează tabelul pentru anul curent, cu fiecare foraj pe rând, zilele anului pe coloane și
          adâncimea finală afișată pe zilele în care forajul este în lucru. Zilele fără activitate sunt marcate cu <strong>x</strong>.
        </p>
        <button
          type="button"
          onClick={downloadRaportare}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Descarcă Raportare (CSV pentru Excel)
        </button>
      </section>
    </div>
  );
}
