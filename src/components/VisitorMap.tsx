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

export default function VisitorMap({ points, projectId }: VisitorMapProps) {
  const center: [number, number] = points.length
    ? [Number(points[0].lat), Number(points[0].lng)]
    : [44.37, 23.13];

  return (
    <div className="h-full w-full min-h-[300px] relative">
      <MapContainer center={center} zoom={points.length ? 12 : 8} className="h-full w-full" zoomControl={false}>
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
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[Number(p.lat), Number(p.lng)]}
            icon={createIcon(STATUS_COLORS[p.status])}
          >
            <Tooltip permanent direction="top">
              {p.code}
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{p.code}</p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline mb-1"
                  title="Deschide în Google Maps"
                >
                  🧭 Navighează
                </a>
                {p.notes && (
                  <p className="text-slate-600 mb-1 whitespace-pre-wrap">{p.notes}</p>
                )}
                <p className="text-slate-600">{p.status}</p>
                {p.assigned_team && <p>Echipă: {p.assigned_team}</p>}
                {p.completed_at && (
                  <p>Finalizat: {new Date(p.completed_at).toLocaleString("ro")}</p>
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
