"use client";

import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  LayersControl,
  ZoomControl,
} from "react-leaflet";
import MapAnnotationsLayer from "./MapAnnotationsLayer";
import MapLegend from "./MapLegend";

const { BaseLayer } = LayersControl;
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint, DrillPointStatus } from "@/lib/types";

// Fix default marker icon in Next.js
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
    html: `<span style="background:${color};width:24px;height:24px;border-radius:50%;display:block;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface PointPopupProps {
  point: DrillPoint;
  onUpdate: () => void;
  isAdmin?: boolean;
}

function PointPopup({ point, onUpdate, isAdmin }: PointPopupProps) {
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [finalDepth, setFinalDepth] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("team_name").eq("id", user.id).single().then(({ data }) => {
          setMyTeam(data?.team_name ?? null);
        });
      }
    });
  }, [supabase]);

  async function updateStatus(newStatus: "in_lucru" | "finalizat", finalDepth?: string | null) {
    setError(null);
    setUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("team_name").eq("id", user?.id).single();

    const updates: Partial<DrillPoint> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "in_lucru") {
      updates.assigned_team = profile?.team_name ?? null;
      updates.started_at = new Date().toISOString();
    } else {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = user?.id ?? null;
      updates.final_depth = finalDepth?.trim() || null;
      if (!(point.assigned_team ?? "").trim() && profile?.team_name) {
        updates.assigned_team = profile.team_name;
      }
    }

    const { data: updated, error: err } = await supabase
      .from("drill_points")
      .update(updates)
      .eq("id", point.id)
      .in("status", newStatus === "in_lucru" ? ["de_facut"] : ["in_lucru"])
      .select("id");

    setUpdating(false);
    if (err || !updated?.length) {
      setError(
        err?.message
          ? `Eroare: ${err.message}`
          : "Punctul a fost preluat de altă echipă sau nu mai poate fi modificat."
      );
      return;
    }
    onUpdate();
  }

  const canClaim = point.status === "de_facut";
  const assignedTeam = (point.assigned_team ?? "").trim();
  const teamMatch =
    assignedTeam.toLowerCase() === (myTeam ?? "").trim().toLowerCase();
  const noTeamAssigned = assignedTeam === "";
  const canComplete =
    point.status === "in_lucru" && (isAdmin || teamMatch || noTeamAssigned);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;

  return (
    <div className="min-w-[200px] p-1">
      <p className="font-semibold text-slate-800">{point.code}</p>
      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-2"
        title="Deschide în Google Maps"
      >
        🧭 Navighează
      </a>
      {point.notes && (
        <p className="text-xs text-slate-600 mb-2 whitespace-pre-wrap">{point.notes}</p>
      )}
      <p className="text-xs text-slate-500 mb-2">Status: {point.status}</p>
      {point.assigned_team && <p className="text-xs text-amber-700 mb-2">Echipă: {point.assigned_team}</p>}
      {canComplete && (
        <div className="mb-2">
          <label className="block text-xs text-slate-600 mb-1">Adâncime finală (m)</label>
          <input
            type="text"
            value={finalDepth}
            onChange={(e) => setFinalDepth(e.target.value)}
            placeholder="ex: 12.5 (opțional)"
            className="w-full px-2 py-1.5 border rounded text-sm"
          />
        </div>
      )}
      {point.status === "in_lucru" && !canComplete && !isAdmin && (
        <p className="text-xs text-orange-600 mb-2">
          {noTeamAssigned
            ? "Se încarcă..."
            : `Punctul e al echipei „${point.assigned_team}”. ${myTeam != null ? `Echipa ta: „${myTeam}” – doar echipa care l-a preluat poate finaliza.` : "Se încarcă..."}`}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {canClaim && (
          <button
            onClick={() => updateStatus("in_lucru")}
            disabled={updating}
            className="px-4 py-2.5 bg-amber-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            În lucru
          </button>
        )}
        {canComplete && (
          <button
            onClick={() => updateStatus("finalizat", finalDepth || undefined)}
            disabled={updating}
            className="px-4 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 min-h-[44px] touch-manipulation"
          >
            Finalizat
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

interface MapWithPointsProps {
  points: DrillPoint[];
  projectId?: string;
  onRefresh?: () => void;
  isAdmin?: boolean;
}

export default function MapWithPoints({
  points,
  projectId,
  isAdmin,
  onRefresh,
}: MapWithPointsProps) {
  const center: [number, number] = points.length
    ? [Number(points[0].lat), Number(points[0].lng)]
    : [44.37, 23.13];

  return (
    <div className="h-full w-full min-h-[300px] relative">
      {points.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 px-4 py-2 rounded-lg shadow text-sm text-slate-600">
          Nu există puncte de afișat. Importă din CSV sau adaugă manual.
        </div>
      )}
      <MapContainer
        center={center}
        zoom={points.length ? 13 : 9}
        className="h-full w-full"
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <LayersControl position="topright">
          <BaseLayer name="Hartă" checked>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
            onRefresh={onRefresh}
          />
        )}
        {points.map((point) => (
          <Marker
            key={point.id}
            position={[Number(point.lat), Number(point.lng)]}
            icon={createIcon(STATUS_COLORS[point.status])}
          >
            <Tooltip permanent direction="top">
              {point.code}
            </Tooltip>
            <Popup>
              <PointPopupWithRefresh point={point} onRefresh={onRefresh} isAdmin={isAdmin} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <MapLegend />
    </div>
  );
}

function PointPopupWithRefresh({
  point,
  onRefresh,
  isAdmin,
}: {
  point: DrillPoint;
  onRefresh?: () => void;
  isAdmin?: boolean;
}) {
  const onUpdate = () => onRefresh?.();
  return <PointPopup point={point} onUpdate={onUpdate} isAdmin={isAdmin} />;
}