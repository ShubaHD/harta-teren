"use client";

const LEGEND_ITEMS = [
  { color: "#3b82f6", label: "De făcut" },
  { color: "#eab308", label: "În lucru" },
  { color: "#22c55e", label: "Foraj finalizat" },
] as const;

export default function MapLegend() {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 bg-white/95 rounded-lg shadow border text-xs">
      {LEGEND_ITEMS.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-white shadow shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-slate-700">{label}</span>
        </div>
      ))}
    </div>
  );
}
