"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import DownloadMapButton from "./DownloadMapButton";
import PrefetchOfflineButton from "./PrefetchOfflineButton";
import UserLocationLayer, { distanceToPoint, formatDistance } from "./UserLocationLayer";

const { BaseLayer } = LayersControl;
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import type { DrillPoint, DrillPointStatus } from "@/lib/types";
import {
  getProfileForOffline,
  saveProfileForOffline,
  applyStatusUpdateOffline,
} from "@/lib/offline-service";
import { getPendingUpdates } from "@/lib/offline-store";
import UnsyncedBadge from "@/components/UnsyncedBadge";

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

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b);
}

interface PointPopupProps {
  point: DrillPoint;
  onUpdate: () => void;
  isAdmin?: boolean;
  isOffline?: boolean;
  projectId?: string;
  userPosition?: { lat: number; lng: number } | null;
  hasUnsynced?: boolean;
}

function PointPopup({ point, onUpdate, isAdmin, isOffline, projectId, userPosition, hasUnsynced }: PointPopupProps) {
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [finalDepth, setFinalDepth] = useState("");

  // La montare: salvează userId în cache din sesiune (fără rețea), ca offline să avem mereu userId
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.id) {
        const cached = await getProfileForOffline();
        if (!cached) {
          await saveProfileForOffline({
            userId: session.user.id,
            teamName: null,
            isAdmin: false,
          });
        }
      }
    });
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("team_name, role")
          .eq("id", user.id)
          .single();
        const team = data?.team_name ?? null;
        setMyTeam(team);
        await saveProfileForOffline({
          userId: user.id,
          teamName: team,
          isAdmin: data?.role === "admin",
        });
      } catch {
        const cached = await getProfileForOffline();
        if (cached) setMyTeam(cached.teamName);
      }
    });
  }, [supabase]);

  function isNetworkError(e: unknown): boolean {
    if (e instanceof TypeError && e.message?.toLowerCase().includes("fetch")) return true;
    if (e instanceof Error && /network|failed to fetch|load failed/i.test(e.message)) return true;
    return false;
  }

  async function updateStatus(newStatus: "in_lucru" | "finalizat", finalDepthVal?: string | null) {
    setError(null);
    setUpdating(true);

    let profile: { team_name: string | null } = { team_name: myTeam };
    let userId: string | undefined;
    let usedOffline = isOffline;

    // Offline: nu apelăm getUser() (face request). Folosim doar getSession() (cookie) + cache profil.
    if (isOffline) {
      const { data: { session } } = await supabase.auth.getSession();
      const cached = await getProfileForOffline();
      userId = session?.user?.id ?? cached?.userId;
      profile = { team_name: cached?.teamName ?? myTeam ?? null };
      if (userId && !cached) {
        await saveProfileForOffline({
          userId,
          teamName: myTeam ?? null,
          isAdmin: false,
        });
      }
      if (userId && !profile.team_name && myTeam) profile = { team_name: myTeam };
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
        if (userId) {
          const { data: p } = await supabase.from("profiles").select("team_name").eq("id", userId).single();
          profile = { team_name: p?.team_name ?? myTeam ?? null };
        }
      } catch (e) {
        if (isNetworkError(e)) {
          usedOffline = true;
          const { data: { session } } = await supabase.auth.getSession();
          userId = session?.user?.id;
          const cached = await getProfileForOffline();
          profile = { team_name: cached?.teamName ?? myTeam ?? null };
          if (userId && !cached) {
            await saveProfileForOffline({
              userId,
              teamName: myTeam ?? null,
              isAdmin: false,
            });
          }
          if (userId && !profile.team_name && myTeam) profile = { team_name: myTeam };
        } else {
          setUpdating(false);
          setError("Eroare la autentificare. Încearcă din nou.");
          return;
        }
      }
    }

    if (usedOffline && projectId && userId) {
      try {
        await applyStatusUpdateOffline(projectId, point, {
          pointId: point.id,
          action: newStatus === "in_lucru" ? "claim" : "complete",
          teamName: profile.team_name,
          userId,
          finalDepth: finalDepthVal?.trim() || null,
        });
        setOfflineSaved(true);
        setTimeout(() => setOfflineSaved(false), 4000);
        onUpdate();
      } catch (e) {
        setError("Eroare la salvare locală. Încearcă din nou.");
      }
      setUpdating(false);
      return;
    }

    if (!userId) {
      setError(
        usedOffline
          ? "Sesiunea nu e disponibilă offline. Conectează-te la internet, deschide harta, apoi poți folosi din nou offline."
          : "Nu ești autentificat. Conectează-te la internet și reîncearcă."
      );
      setUpdating(false);
      return;
    }

    const updates: Partial<DrillPoint> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "in_lucru") {
      updates.assigned_team = profile.team_name ?? null;
      updates.started_at = new Date().toISOString();
    } else {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = userId ?? null;
      updates.final_depth = finalDepthVal?.trim() || null;
      if (!(point.assigned_team ?? "").trim() && profile.team_name) {
        updates.assigned_team = profile.team_name;
      }
    }

    try {
      const { data: updated, error: err } = await supabase
        .from("drill_points")
        .update(updates)
        .eq("id", point.id)
        .in("status", newStatus === "in_lucru" ? ["de_facut"] : ["in_lucru"])
        .select("id");

      if (err || !updated?.length) {
        setError(
          err?.message
            ? `Eroare: ${err.message}`
            : "Punctul a fost preluat de altă echipă sau nu mai poate fi modificat."
        );
        return;
      }
      onUpdate();
    } catch (e) {
      if (isNetworkError(e)) {
        try {
          const cached = await getProfileForOffline();
          if (cached && projectId) {
            await applyStatusUpdateOffline(projectId, point, {
              pointId: point.id,
              action: newStatus === "in_lucru" ? "claim" : "complete",
              teamName: profile.team_name ?? cached.teamName,
              userId: cached.userId,
              finalDepth: finalDepthVal?.trim() || null,
            });
            onUpdate();
            setError("Fără conexiune. Modificarea a fost salvată local și se va sincroniza când revii online.");
          } else {
            setError("Fără conexiune. Deschide aplicația online o dată, apoi poți salva offline.");
          }
        } catch {
          setError("Fără conexiune. Încearcă din nou când ai internet.");
        }
      } else {
        setError("Eroare neașteptată. Încearcă din nou.");
      }
    } finally {
      setUpdating(false);
    }
  }

  const canClaim = point.status === "de_facut";
  const assignedTeam = (point.assigned_team ?? "").trim();
  const teamMatch =
    assignedTeam.toLowerCase() === (myTeam ?? "").trim().toLowerCase();
  const noTeamAssigned = assignedTeam === "";
  const canComplete =
    point.status === "in_lucru" && (isAdmin || teamMatch || noTeamAssigned);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;

  const distM = userPosition ? distanceToPoint(userPosition, point) : null;
  const showDist = distM != null && Number.isFinite(distM);

  return (
    <div className="min-w-[200px] p-1">
      <p className="font-semibold text-slate-800">{point.code}</p>
      {showDist && (
        <p className="text-sm text-slate-600 mb-2">
          📏 Distanță până la tine: <strong>{formatDistance(distM!)}</strong>
        </p>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline min-h-[44px] items-center touch-manipulation"
          title="Deschide în Google Maps"
        >
          🧭 Navighează
        </a>
        <Link
          href={`/foraj/${point.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline min-h-[44px] items-center touch-manipulation"
          title="Fișă detaliată foraj"
        >
          📋 Fișă
        </Link>
      </div>
      {point.notes && (
        <p className="text-xs text-slate-600 mb-2 whitespace-pre-wrap">{point.notes}</p>
      )}
      <p className="text-xs text-slate-500 mb-2">Status: {point.status}</p>
      {(point.adancime_propusa != null && point.adancime_propusa !== "") && (
        <p className="text-xs text-slate-600 mb-1">Adâncime propusă (h): {point.adancime_propusa} m</p>
      )}
      {(point.kilometraj != null && point.kilometraj !== "") && (
        <p className="text-xs text-slate-600 mb-1">km: {point.kilometraj}</p>
      )}
      {hasUnsynced && (
        <p className="mb-2">
          <UnsyncedBadge />
        </p>
      )}
      {point.assigned_team && <p className="text-xs text-amber-700 mb-2">Echipă: {point.assigned_team}</p>}
      {canComplete && (
        <div className="mb-2">
          <label className="block text-xs text-slate-600 mb-1">Adâncime finală (m)</label>
          <input
            type="text"
            value={finalDepth}
            onChange={(e) => setFinalDepth(e.target.value)}
            placeholder="ex: 12.5 (opțional)"
            className="w-full px-2 py-2.5 min-h-[44px] border rounded text-sm touch-manipulation"
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
      {isOffline && (
        <p className="text-xs text-amber-600 mb-2">Mod offline – se va sincroniza la revenirea conexiunii.</p>
      )}
      {offlineSaved && (
        <p className="text-xs text-green-600 mb-2 font-medium">✓ Salvat local. Se va sincroniza când revii online.</p>
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
  isOffline?: boolean;
  pointIds?: string[];
}

export default function MapWithPoints({
  points,
  projectId,
  isAdmin,
  onRefresh,
  isOffline = false,
  pointIds = [],
}: MapWithPointsProps) {
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pendingPointIds, setPendingPointIds] = useState<Set<string>>(new Set());
  const selectedPoint = selectedPointId ? points.find((p) => p.id === selectedPointId) ?? null : null;

  useEffect(() => {
    getPendingUpdates().then((updates) => setPendingPointIds(new Set(updates.map((u) => u.pointId))));
  }, [points]);

  const firstValid = points.find((p) => isValidLatLng(p.lat, p.lng));
  const center: [number, number] = firstValid
    ? [Number(firstValid.lat), Number(firstValid.lng)]
    : [44.37, 23.13];

  const statusCounts =
    points.length > 0
      ? {
          de_facut: points.filter((p) => p.status === "de_facut").length,
          in_lucru: points.filter((p) => p.status === "in_lucru").length,
          finalizat: points.filter((p) => p.status === "finalizat").length,
        }
      : undefined;

  return (
    <div className="h-full w-full min-h-[300px] relative">
      {points.length > 0 ? (
        <MapLegend statusCounts={statusCounts}>
          <PrefetchOfflineButton pointIds={pointIds} projectId={projectId} disabled={isOffline} />
          <DownloadMapButton points={points} />
        </MapLegend>
      ) : (
        <>
          <MapLegend />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 px-4 py-2 rounded-lg shadow text-sm text-slate-600">
            Nu există puncte de afișat. Importă din CSV sau adaugă manual.
          </div>
        </>
      )}
      <MapContainer
        center={center}
        zoom={points.length ? 13 : 9}
        className="h-full w-full"
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <LayersControl position="bottomleft">
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
        <UserLocationLayer
          onPositionChange={setUserPosition}
          selectedPoint={selectedPoint}
        />
        {points.filter((point) => isValidLatLng(point.lat, point.lng)).map((point) => (
          <Marker
            key={point.id}
            position={[Number(point.lat), Number(point.lng)]}
            icon={createIcon(STATUS_COLORS[point.status])}
            eventHandlers={{
              click: () => setSelectedPointId(point.id),
            }}
          >
            <Tooltip permanent direction="top">
              {point.code}
            </Tooltip>
            <Popup eventHandlers={{ remove: () => setSelectedPointId(null) }}>
              <PointPopupWithRefresh
                point={point}
                onRefresh={onRefresh}
                isAdmin={isAdmin}
                isOffline={isOffline}
                projectId={projectId}
                userPosition={userPosition}
                hasUnsynced={pendingPointIds.has(point.id)}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function PointPopupWithRefresh({
  point,
  onRefresh,
  isAdmin,
  isOffline,
  projectId,
  userPosition,
  hasUnsynced,
}: {
  point: DrillPoint;
  onRefresh?: () => void;
  isAdmin?: boolean;
  isOffline?: boolean;
  projectId?: string;
  userPosition?: { lat: number; lng: number } | null;
  hasUnsynced?: boolean;
}) {
  const onUpdate = () => onRefresh?.();
  return (
    <PointPopup
      point={point}
      onUpdate={onUpdate}
      isAdmin={isAdmin}
      isOffline={isOffline}
      projectId={projectId}
      userPosition={userPosition}
      hasUnsynced={hasUnsynced}
    />
  );
}