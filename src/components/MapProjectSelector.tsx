"use client";

import { useRouter } from "next/navigation";

interface MapProjectSelectorProps {
  projects: { id: string; name: string }[];
  selectedId: string | null;
}

export default function MapProjectSelector({ projects, selectedId }: MapProjectSelectorProps) {
  const router = useRouter();
  if (projects.length <= 1) return null;
  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/mapa?project=${v}` : "/mapa");
      }}
      className="text-sm border rounded px-2 py-2 min-h-[44px] touch-manipulation"
    >
      <option value="">Selectează proiect</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
