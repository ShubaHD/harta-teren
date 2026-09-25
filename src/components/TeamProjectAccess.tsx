"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const IMPLICIT_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

interface TeamProjectAccessProps {
  userId: string;
  teamName: string;
  projects: { id: string; name: string }[];
  assignedIds: string[];
}

export default function TeamProjectAccess({
  userId,
  teamName,
  projects,
  assignedIds,
}: TeamProjectAccessProps) {
  const router = useRouter();
  const visibleProjects = useMemo(
    () => projects.filter((p) => p.id !== IMPLICIT_PROJECT_ID),
    [projects]
  );
  const [open, setOpen] = useState(false);
  const [allProjects, setAllProjects] = useState(assignedIds.length === 0);
  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [loading, setLoading] = useState(false);

  const summary = allProjects
    ? "Toate"
    : selected.length === 0
      ? "Niciunul"
      : selected.length === 1
        ? visibleProjects.find((p) => p.id === selected[0])?.name ?? "1 proiect"
        : `${selected.length} proiecte`;

  function toggleProject(id: string) {
    setAllProjects(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    const projectIds = allProjects ? [] : selected;
    if (!allProjects && projectIds.length === 0) {
      alert("Bifează cel puțin un proiect sau alege „Toate proiectele”.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/teams/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectIds }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(data.error || "Eroare la salvare.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-1 text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
        title={`Acces proiecte pentru ${teamName}`}
      >
        {summary}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 max-h-80 overflow-auto rounded-lg border bg-white shadow-lg p-3 text-left">
          <p className="text-xs text-slate-500 mb-2">
            Fără restricție = vede tot. Bifează proiecte ca să limitezi accesul.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <input
              type="checkbox"
              checked={allProjects}
              onChange={(e) => {
                setAllProjects(e.target.checked);
                if (e.target.checked) setSelected([]);
              }}
            />
            Toate proiectele
          </label>
          <div className="space-y-1 border-t pt-2">
            {visibleProjects.map((p) => (
              <label key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!allProjects && selected.includes(p.id)}
                  onChange={() => toggleProject(p.id)}
                />
                <span>{p.name}</span>
              </label>
            ))}
            {visibleProjects.length === 0 && (
              <p className="text-xs text-slate-500">Nu există proiecte.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 text-slate-600"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {loading ? "..." : "Salvează"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
