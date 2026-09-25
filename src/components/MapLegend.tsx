"use client";

import { useI18n } from "./I18nProvider";

const LEGEND_ITEMS = [
  { color: "#3b82f6", status: "de_facut" as const, key: "legend.todo" as const },
  { color: "#eab308", status: "in_lucru" as const, key: "legend.progress" as const },
  { color: "#22c55e", status: "finalizat" as const, key: "legend.done" as const },
] as const;

export interface StatusCounts {
  de_facut: number;
  in_lucru: number;
  finalizat: number;
}

export type PriorityFilter = "all" | "1" | "2" | "3";

export interface PriorityCounts {
  "1": number;
  "2": number;
  "3": number;
}

interface MapLegendProps {
  /** Număr de puncte per status – se afișează lângă fiecare etichetă și se actualizează la finalizare */
  statusCounts?: StatusCounts;
  /** Filtru Prioritate 1 / 2 / 3 pe hartă */
  priorityFilter?: PriorityFilter;
  onPriorityFilterChange?: (value: PriorityFilter) => void;
  priorityCounts?: PriorityCounts;
  /** Conținut adițional (ex: butoane) afișat în dreapta */
  children?: React.ReactNode;
}

const PRIORITY_BUTTONS: { value: PriorityFilter; labelKey?: "legend.all"; label?: string }[] = [
  { value: "all", labelKey: "legend.all" },
  { value: "1", label: "P1" },
  { value: "2", label: "P2" },
  { value: "3", label: "P3" },
];

export default function MapLegend({
  statusCounts,
  priorityFilter,
  onPriorityFilterChange,
  priorityCounts,
  children,
}: MapLegendProps) {
  const { t } = useI18n();
  return (
    <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-[1000] flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2 sm:gap-x-3 sm:gap-y-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-white/95 rounded-lg shadow border text-xs">
      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 min-w-0 shrink">
        {LEGEND_ITEMS.map(({ color, status, key }) => (
          <div key={status} className="flex items-center gap-1 shrink-0">
            <span
              className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white shadow shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-700">{t(key)}</span>
            {statusCounts != null && (
              <span className="font-semibold text-slate-800">
                ({statusCounts[status]} <span className="hidden sm:inline">{t("legend.points")}</span>)
              </span>
            )}
          </div>
        ))}
        {onPriorityFilterChange && (
          <div className="flex items-center gap-1 ml-0 sm:ml-1 pl-0 sm:pl-2 sm:border-l sm:border-slate-200">
            {PRIORITY_BUTTONS.map((btn) => {
              const active = (priorityFilter ?? "all") === btn.value;
              const count =
                btn.value !== "all" && priorityCounts ? priorityCounts[btn.value] : null;
              const label = btn.labelKey ? t(btn.labelKey) : btn.label;
              return (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => onPriorityFilterChange(btn.value)}
                  className={`px-2 py-1 rounded min-h-[32px] touch-manipulation font-medium ${
                    active
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {label}
                  {count != null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 relative z-[1101] justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
