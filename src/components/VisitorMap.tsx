"use client";

import { useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, LayersControl, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { DrillPoint, DrillPointStatus } from "@/lib/types";
import { getCsvLabelRows } from "@/lib/drill-point-label";
import { normalizePrioritate } from "@/lib/csv-import";
import MapAnnotationsLayer from "./MapAnnotationsLayer";
import MapLegend, { type PriorityFilter } from "./MapLegend";
import BoreholeSearch, { FlyToBorehole } from "./BoreholeSearch";
import FieldSitePopupLinks from "./FieldSitePopupLinks";
import { useFieldSiteIndex } from "@/hooks/useFieldSiteIndex";
import { useI18n } from "./I18nProvider";

const { BaseLayer } = LayersControl;

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const STATUS_COLORS: Record<DrillPointStatus, string> = {
  de_facut: "#3b82f6",
  in_lucru: "#eab308",
  finalizat: "#22c55e",
};

function createIcon(color: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `<span style="background:${color};width:20px;height:20px;border-radius:50%;display:block;border:2px solid white"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

interface VisitorMapProps {
  points: DrillPoint[];
  projectId?: string;
}

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b);
}

export default function VisitorMap({ points, projectId }: VisitorMapProps) {
  const { t, locale } = useI18n();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [focusPointId, setFocusPointId] = useState<string | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const fieldSiteIndex = useFieldSiteIndex(points.map((p) => p.id));
  const validPoints = points.filter((p) => isValidLatLng(p.lat, p.lng));
  const visiblePoints = validPoints.filter((p) => {
    if (priorityFilter === "all") return true;
    return normalizePrioritate(p.prioritate) === priorityFilter;
  });
  const center: [number, number] = validPoints.length
    ? [Number(validPoints[0].lat), Number(validPoints[0].lng)]
    : [44.37, 23.13];
  const priorityCounts = {
    "1": points.filter((p) => normalizePrioritate(p.prioritate) === "1").length,
    "2": points.filter((p) => normalizePrioritate(p.prioritate) === "2").length,
    "3": points.filter((p) => normalizePrioritate(p.prioritate) === "3").length,
  };

  return (
    <div className="visitor-map h-full w-full min-h-[300px] relative">
      <MapContainer center={center} zoom={validPoints.length ? 12 : 8} className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomright" />
        <LayersControl position="topright" key={locale}>
          <BaseLayer name={t("map.layerMap")} checked>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name={t("map.layerSatellite")}>
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>
        </LayersControl>
        {projectId && (
          <MapAnnotationsLayer
            projectId={projectId}
            allowedTools={["marker"]}
          />
        )}
        <FlyToBorehole pointId={focusPointId} points={points} markerRefs={markerRefs} />
        {visiblePoints.map((p) => (
          <Marker
            key={p.id}
            position={[Number(p.lat), Number(p.lng)]}
            icon={createIcon(STATUS_COLORS[p.status])}
            ref={(m) => {
              if (m) markerRefs.current.set(p.id, m);
              else markerRefs.current.delete(p.id);
            }}
          >
            <Tooltip permanent direction="top">
              {p.code}
            </Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-semibold text-slate-800">{p.code}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm min-h-[44px]"
                  >
                    🧭 {t("map.navigate")}
                  </a>
                  <FieldSitePopupLinks
                    pointId={p.id}
                    files={fieldSiteIndex.get(p.id)}
                  />
                </div>
                {getCsvLabelRows(p).map((row) => (
                  <p key={row.key + (row.vars?.n ?? "")} className="text-slate-600 mb-0.5 whitespace-pre-wrap">
                    {t(row.key, row.vars)}: {row.value}
                  </p>
                ))}
                <p className="text-slate-500 text-xs mb-1 mt-1">
                  {t("map.status")}:{" "}
                  {t(
                    p.status === "in_lucru"
                      ? "status.in_lucru"
                      : p.status === "finalizat"
                        ? "status.finalizat"
                        : "status.de_facut"
                  )}
                </p>
                {p.assigned_team && <p className="text-slate-600 mb-1">{t("map.team")}: {p.assigned_team}</p>}
                {p.completed_at && (
                  <p className="text-slate-600">{t("map.completedAt")}: {new Date(p.completed_at).toLocaleString(locale)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <MapLegend
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        priorityCounts={priorityCounts}
      >
        <BoreholeSearch
          points={points}
          onSelect={(id) => {
            setPriorityFilter("all");
            setFocusPointId(id);
          }}
        />
      </MapLegend>
    </div>
  );
}
