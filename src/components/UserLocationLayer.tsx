"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMap, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import type { DrillPoint } from "@/lib/types";

// Iconiță locație în stânga jos – la tap cere permisiunea sau centrează harta
function createLocationControl(onClickRef: { current: () => void }): L.Control {
  const Control = L.Control.extend({
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      div.innerHTML = `
        <a href="#" role="button" title="Locația mea" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:white;border:1px solid #e2e8f0;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.12);text-decoration:none;font-size:18px;color:#334155">
          📍
        </a>
      `;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(div.querySelector("a")!, "click", (e) => {
        L.DomEvent.preventDefault(e);
        onClickRef.current?.();
      });
      return div;
    },
  });
  return new Control({ position: "bottomleft" });
}

const STORAGE_KEY = "harta-teren-location-allowed";

const USER_ICON = L.divIcon({
  className: "user-location-marker",
  html: `<span style="background:#2563eb;width:20px;height:20px;border-radius:50%;display:block;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></span>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function distanceToPoint(
  user: { lat: number; lng: number } | null,
  point: { lat: number | string; lng: number | string }
): number | null {
  if (!user) return null;
  if (!Number.isFinite(user.lat) || !Number.isFinite(user.lng)) return null;
  const lat = typeof point.lat === "string" ? parseFloat(point.lat) : point.lat;
  const lng = typeof point.lng === "string" ? parseFloat(point.lng) : point.lng;
  if (isNaN(lat) || isNaN(lng)) return null;
  return haversineDistanceM(user.lat, user.lng, lat, lng);
}

interface UserLocationLayerProps {
  onPositionChange: (pos: { lat: number; lng: number } | null) => void;
  selectedPoint: DrillPoint | null;
}

export default function UserLocationLayer({
  onPositionChange,
  selectedPoint,
}: UserLocationLayerProps) {
  const map = useMap();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [userDenied, setUserDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const controlRef = useRef<L.Control | null>(null);
  const positionRef = useRef<{ lat: number; lng: number } | null>(null);
  positionRef.current = position;
  const onClickRef = useRef<() => void>(() => {});

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        onPositionChange(coords);
        setError(null);
        setUserDenied(false);
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
      },
      (err) => {
        // Nu ștergem poziția – păstrăm ultima locație cunoscută ca markerul să rămână vizibil
        if (err.code === 1) {
          setUserDenied(true);
          setPosition(null);
          onPositionChange(null);
        }
        setError(err.message);
        try {
          if (err.code === 1) localStorage.removeItem(STORAGE_KEY);
        } catch {}
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }, [onPositionChange]);

  const requestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocația nu este disponibilă.");
      return;
    }
    setError(null);
    setUserDenied(false);
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAsking(false);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        onPositionChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        startWatching();
      },
      (err) => {
        setAsking(false);
        setError(err.message);
        if (err.code === 1) setUserDenied(true);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [onPositionChange, startWatching]);

  onClickRef.current = position
    ? () => map.flyTo([position.lat, position.lng], 17, { duration: 0.8 })
    : requestLocation;

  // La prima încărcare: dacă a permis în trecut, pornim direct fără să mai întrebăm
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        startWatching();
      }
    } catch {}
  }, [startWatching]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const posValid = position && Number.isFinite(position.lat) && Number.isFinite(position.lng);
  const pointLat = selectedPoint ? Number(selectedPoint.lat) : NaN;
  const pointLng = selectedPoint ? Number(selectedPoint.lng) : NaN;
  const pointValid = Number.isFinite(pointLat) && Number.isFinite(pointLng);
  const linePositions: [number, number][] =
    posValid && selectedPoint && pointValid
      ? [
          [position!.lat, position!.lng],
          [pointLat, pointLng],
        ]
      : [];

  const hasNoPosition = !position && !asking;

  // Iconiță locație stânga jos – mereu vizibilă; la tap cere permisiunea sau centrează harta
  useEffect(() => {
    const control = createLocationControl(onClickRef);
    map.addControl(control);
    controlRef.current = control;
    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map]);

  return (
    <>
      {posValid && position && (
        <>
          <Marker position={[position.lat, position.lng]} icon={USER_ICON} zIndexOffset={1000}>
            <Tooltip permanent direction="top" opacity={0.9}>
              Poziția ta
            </Tooltip>
          </Marker>
          {linePositions.length === 2 && (
            <Polyline
              positions={linePositions}
              pathOptions={{
                color: "#2563eb",
                weight: 3,
                opacity: 0.8,
                dashArray: "8 8",
              }}
            />
          )}
        </>
      )}
      {/* Când cere permisiunea: mesaj scurt lângă iconița din stânga jos */}
      {asking && (
        <div className="absolute bottom-14 left-2 z-[1000] px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 shadow">
          Apare cererea de permisiune – alege „Permite”.
        </div>
      )}

      {/* După ce a blocat: instrucțiuni lângă iconița de locație (stânga jos) */}
      {userDenied && (
        <div className="absolute bottom-14 left-2 z-[1000] max-w-[280px] bg-white rounded-lg shadow-lg border border-slate-200 p-3">
          <p className="font-medium text-slate-800 text-sm mb-2">Cum activezi locația</p>
          <p className="text-xs text-slate-600 mb-2">
            <strong>Android:</strong> apasă <strong>⋮</strong> (meniu) sau <strong>lacăt</strong> lângă adresă → <strong>Locație</strong> → <strong>Permite</strong>.
          </p>
          <p className="text-xs text-slate-600 mb-3">
            <strong>iPhone:</strong> Setări → Safari → Locație → <strong>Permite</strong>. Sau Setări → Confidențialitate → Locație → Safari.
          </p>
          <p className="text-xs text-slate-500 mb-2">Apoi apasă din nou pe iconița 📍 jos stânga.</p>
          <button
            type="button"
            onClick={() => { setUserDenied(false); setError(null); requestLocation(); }}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Încearcă din nou
          </button>
        </div>
      )}

      {/* Eroare (timeout etc.): mesaj scurt + reîncercare prin iconița 📍 */}
      {error && !userDenied && hasNoPosition && !asking && (
        <div className="absolute bottom-14 left-2 z-[999] max-w-[200px] px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 shadow">
          Locația nu s-a putut citi. Pornește GPS-ul și apasă din nou pe 📍 jos stânga.
        </div>
      )}
    </>
  );
}
