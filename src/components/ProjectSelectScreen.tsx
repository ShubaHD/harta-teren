"use client";

import { useRouter } from "next/navigation";

interface ProjectSelectScreenProps {
  projects: { id: string; name: string }[];
}

export default function ProjectSelectScreen({ projects }: ProjectSelectScreenProps) {
  const router = useRouter();

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-100">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">
        Alege proiectul pe care lucrezi
      </h2>
      <p className="text-sm text-slate-600 mb-6">
        Un cont, toate proiectele. Selectează proiectul activ.
      </p>
      <button
        onClick={() => router.push("/fisa-foraj")}
        className="w-full max-w-sm mb-4 px-6 py-4 rounded-lg bg-blue-50 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-100 text-left font-medium text-slate-800 transition-colors flex items-center gap-2"
      >
        <span>📋</span>
        Fișa de foraj
      </button>
      <div className="grid gap-3 w-full max-w-sm">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/mapa?project=${p.id}`)}
            className="px-6 py-4 rounded-lg bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-left font-medium text-slate-800 transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
