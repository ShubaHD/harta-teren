"use client";

import { useEffect, useMemo, useState } from "react";
import { useMap } from "react-leaflet";
import type { MutableRefObject } from "react";
import type { Marker as LeafletMarker } from "leaflet";
import type { DrillPoint } from "@/lib/types";
import { normalizeDrillPointCode } from "@/lib/csv-import";
import { useI18n } from "./I18nProvider";

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b);
}

export function FlyToBorehole({
  pointId,
  points,
  markerRefs,
}: {
  pointId: string | null;
  points: DrillPoint[];
  markerRefs: MutableRefObject<Map<string, LeafletMarker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!pointId) return;
    const p = points.find((x) => x.id === pointId);
    if (!p || !isValidLatLng(p.lat, p.lng)) return;
    map.flyTo([Number(p.lat), Number(p.lng)], 16, { duration: 0.6 });
    const t = window.setTimeout(() => {
      markerRefs.current.get(pointId)?.openPopup();
    }, 650);
    return () => window.clearTimeout(t);
  }, [pointId, points, map, markerRefs]);
  return null;
}

interface BoreholeSearchProps {
  points: DrillPoint[];
  onSelect: (pointId: string) => void;
}

export default function BoreholeSearch({ points, onSelect }: BoreholeSearchProps) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const t = q.trim();
    if (t.length < 2) return [];
    const nq = normalizeDrillPointCode(t);
    return points
      .filter((p) => {
        const nc = normalizeDrillPointCode(p.code);
        return p.code.toLowerCase().includes(t.toLowerCase()) || nc.includes(nq);
      })
      .slice(0, 8);
  }, [q, points]);

  function choose(p: DrillPoint) {
    onSelect(p.id);
    setQ(p.code);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            choose(matches[0]);
          }
        }}
        placeholder={t("search.placeholder")}
        className="w-36 sm:w-44 px-2 py-1.5 min-h-[32px] border border-slate-300 rounded text-xs text-slate-800 bg-white"
        aria-label={t("search.aria")}
      />
      {open && matches.length > 0 && (
        <ul className="absolute right-0 mt-1 w-48 bg-white border rounded shadow-lg z-[1102] max-h-48 overflow-auto text-xs">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-2 py-2 hover:bg-slate-100 touch-manipulation"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
              >
                {p.code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
