"use client";

const LEGEND_ITEMS = [
  { color: "#3b82f6", label: "De făcut", status: "de_facut" as const },
  { color: "#eab308", label: "În lucru", status: "in_lucru" as const },
  { color: "#22c55e", label: "Foraj finalizat", status: "finalizat" as const },
] as const;

export interface StatusCounts {
  de_facut: number;
  in_lucru: number;
  finalizat: number;
}

interface MapLegendProps {
  /** Număr de puncte per status – se afișează lângă fiecare etichetă și se actualizează la finalizare */
  statusCounts?: StatusCounts;
  /** Conținut adițional (ex: butoane) afișat în dreapta */
  children?: React.ReactNode;
}

export default function MapLegend({ statusCounts, children }: MapLegendProps) {
  return (
    <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1000] flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2 sm:gap-x-3 sm:gap-y-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-white/95 rounded-lg shadow border text-xs">
      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 min-w-0 shrink">
        {LEGEND_ITEMS.map(({ color, label, status }) => (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <span
              className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white shadow shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-700">{label}</span>
            {statusCounts != null && (
              <span className="font-semibold text-slate-800">
                ({statusCounts[status]} <span className="hidden sm:inline">puncte</span>)
              </span>
            )}
          </div>
        ))}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 relative z-[1101] justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
