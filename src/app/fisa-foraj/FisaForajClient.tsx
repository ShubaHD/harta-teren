"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface FisaForajClientProps {
  projects: { id: string; name: string }[];
  selectedProjectId: string | null;
  points: { id: string; code: string; status: string }[];
  projectName: string;
}

const statusLabels: Record<string, string> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  finalizat: "Finalizat",
};

const statusColors: Record<string, string> = {
  de_facut: "bg-blue-50 border-blue-200 text-blue-800",
  in_lucru: "bg-amber-50 border-amber-200 text-amber-800",
  finalizat: "bg-green-50 border-green-200 text-green-800",
};

export default function FisaForajClient({
  projects,
  selectedProjectId,
  points,
  projectName,
}: FisaForajClientProps) {
  const router = useRouter();

  if (!selectedProjectId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">
          Alege proiectul pentru fișa de foraj
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Selectează proiectul pentru a vedea punctele de foraj.
        </p>
        <div className="grid gap-3 w-full max-w-sm">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/fisa-foraj?project=${p.id}`)}
              className="px-6 py-4 rounded-lg bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-left font-medium text-slate-800 transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push("/fisa-foraj")}
          className="text-sm text-slate-600 hover:text-slate-800 mb-2 block"
        >
          ← Schimbă proiectul
        </button>
        <h2 className="text-lg font-semibold text-slate-800">{projectName}</h2>
        <p className="text-sm text-slate-600">
          {points.length === 1 ? "1 punct de foraj" : `${points.length} puncte de foraj`}
        </p>
      </div>
      <div className="space-y-2">
        {points.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">
            Niciun punct de foraj în acest proiect.
          </p>
        ) : (
          points.map((pt) => (
            <Link
              key={pt.id}
              href={`/foraj/${pt.id}`}
              className="block px-4 py-3 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{pt.code}</span>
                <span
                  className={`text-xs px-2 py-1 rounded border ${statusColors[pt.status] ?? "bg-slate-50 border-slate-200"}`}
                >
                  {statusLabels[pt.status] ?? pt.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
