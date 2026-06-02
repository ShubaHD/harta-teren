"use client";

import { MapContainer, TileLayer, Marker, Popup, Tooltip, LayersControl, ZoomControl } from "react-leaflet";
import L from "leaflet";
import type { DrillPoint, DrillPointStatus } from "@/lib/types";
import MapAnnotationsLayer from "./MapAnnotationsLayer";
import MapLegend from "./MapLegend";

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
  const validPoints = points.filter((p) => isValidLatLng(p.lat, p.lng));
  const center: [number, number] = validPoints.length
    ? [Number(validPoints[0].lat), Number(validPoints[0].lng)]
    : [44.37, 23.13];

  return (
    <div className="visitor-map h-full w-full min-h-[300px] relative">
      <MapContainer center={center} zoom={validPoints.length ? 12 : 8} className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomright" />
        <LayersControl position="topright">
          <BaseLayer name="Hartă" checked>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>
          <BaseLayer name="Satelit">
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
        {validPoints.map((p) => (
          <Marker
            key={p.id}
            position={[Number(p.lat), Number(p.lng)]}
            icon={createIcon(STATUS_COLORS[p.status])}
          >
            <Tooltip permanent direction="top">
              {p.code}
            </Tooltip>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-semibold text-slate-800">{p.code}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline mb-2 text-sm"
                >
                  🧭 Navighează
                </a>
                <p className="text-slate-500 text-xs mb-1">Status: {p.status}</p>
                {(p.adancime_propusa != null && p.adancime_propusa !== "") && (
                  <p className="text-slate-600 mb-1">Adâncime propusă (h): {p.adancime_propusa} m</p>
                )}
                {(p.kilometraj != null && p.kilometraj !== "") && (
                  <p className="text-slate-600 mb-1">km: {p.kilometraj}</p>
                )}
                {p.notes && (
                  <p className="text-slate-600 mb-1 whitespace-pre-wrap"><span className="text-slate-500">Observații:</span> {p.notes}</p>
                )}
                {p.assigned_team && <p className="text-slate-600 mb-1">Echipă: {p.assigned_team}</p>}
                {p.completed_at && (
                  <p className="text-slate-600">Finalizat: {new Date(p.completed_at).toLocaleString("ro")}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <MapLegend />
    </div>
  );
}
