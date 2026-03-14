"use client";

import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    L: typeof L;
  }
}

export type AnnotationType = "line" | "arrow" | "marker" | "text";

export interface MapAnnotation {
  id: string;
  project_id: string;
  type: AnnotationType;
  geom: GeoJSON.Geometry;
  properties: Record<string, unknown>;
  created_by: string | null;
}

function createArrowIcon(angleDeg = 0) {
  return L.divIcon({
    className: "arrow-marker",
    html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #dc2626;margin-left:-6px;margin-top:-12px;transform:rotate(${angleDeg}deg)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 12],
  });
}

function createAttentionIcon() {
  return L.divIcon({
    className: "attention-marker",
    html: `<div style="width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid #eab308;margin-left:-10px;margin-top:-18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))"></div>`,
    iconSize: [20, 18],
    iconAnchor: [10, 18],
  });
}

function createTextIcon(text: string) {
  return L.divIcon({
    className: "text-annotation",
    html: `<div style="background:white;padding:2px 6px;border:1px solid #94a3b8;border-radius:4px;font-size:12px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${escapeHtml(text)}</div>`,
    iconSize: [100, 24],
    iconAnchor: [5, 12],
  });
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

interface MapAnnotationsLayerProps {
  projectId: string | undefined;
  onRefresh?: () => void;
  /** Dacă e setat, doar aceste instrumente sunt afișate. Ex: ['marker','text'] pentru vizitatori */
  allowedTools?: AnnotationType[];
}

export default function MapAnnotationsLayer({
  projectId,
  onRefresh,
  allowedTools,
}: MapAnnotationsLayerProps) {
  const tools = allowedTools ?? (["line", "arrow", "marker"] as AnnotationType[]);
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const geomanInitialized = useRef(false);
  const drawModeRef = useRef<AnnotationType | null>(null);
  const [drawMode, setDrawMode] = useState<AnnotationType | null>(null);

  const loadAnnotationsRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!projectId || !map) return;

    const supabase = createClient();

    const loadAnnotations = async () => {
      const { data } = await supabase
        .from("map_annotations")
        .select("*")
        .eq("project_id", projectId);

      if (!data) return;

      if (!layerGroupRef.current) {
        layerGroupRef.current = L.layerGroup().addTo(map);
      }
      layerGroupRef.current.clearLayers();

      for (const ann of data as MapAnnotation[]) {
        if (ann.type === "line" && ann.geom.type === "LineString") {
          const latlngs = ann.geom.coordinates.map(
            (c) => [c[1], c[0]] as [number, number]
          );
          const line = L.polyline(latlngs, {
            color: "#2563eb",
            weight: 3,
          });
          (line as L.Polyline & { _annotationId?: string })._annotationId = ann.id;
          layerGroupRef.current.addLayer(line);
          (line as L.Layer & { pm?: { enable: () => void } }).pm?.enable();
        } else if (ann.type === "arrow" && ann.geom.type === "LineString") {
          const latlngs = ann.geom.coordinates.map(
            (c) => [c[1], c[0]] as [number, number]
          );
          const line = L.polyline(latlngs, {
            color: "#dc2626",
            weight: 3,
          });
          (line as L.Polyline & { _annotationId?: string })._annotationId = ann.id;
          layerGroupRef.current.addLayer(line);
          (line as L.Layer & { pm?: { enable: () => void } }).pm?.enable();
          if (latlngs.length >= 2) {
            const end = latlngs[latlngs.length - 1];
            const prev = latlngs[latlngs.length - 2];
            const angle =
              (Math.atan2(end[1] - prev[1], end[0] - prev[0]) * 180) / Math.PI +
              90;
            const arrowMarker = L.marker(end, {
              icon: createArrowIcon(angle),
            });
            (arrowMarker as L.Marker & { _annotationId?: string })._annotationId =
              ann.id;
            layerGroupRef.current.addLayer(arrowMarker);
            (arrowMarker as L.Layer & { pm?: { enable: () => void } }).pm?.enable();
          }
        } else if (ann.type === "marker" && ann.geom.type === "Point") {
          const [lng, lat] = ann.geom.coordinates;
          const marker = L.marker([lat, lng], {
            icon: createAttentionIcon(),
          });
          (marker as L.Marker & { _annotationId?: string })._annotationId =
            ann.id;
          const props = (ann.properties || {}) as { text?: string };
          if (props.text) {
            marker.bindTooltip(props.text, { permanent: true });
          }
          layerGroupRef.current.addLayer(marker);
          (marker as L.Layer & { pm?: { enable: () => void } }).pm?.enable();
        } else if (ann.type === "text" && ann.geom.type === "Point") {
          const [lng, lat] = ann.geom.coordinates;
          const text = ((ann.properties || {}) as { text?: string }).text || "";
          const marker = L.marker([lat, lng], {
            icon: createTextIcon(text),
          });
          (marker as L.Marker & { _annotationId?: string })._annotationId =
            ann.id;
          marker.bindPopup(text);
          layerGroupRef.current.addLayer(marker);
          (marker as L.Layer & { pm?: { enable: () => void } }).pm?.enable();
        }
      }
    };

    loadAnnotationsRef.current = loadAnnotations;
    loadAnnotations();

    const sub = supabase
      .channel("map_annotations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_annotations",
          filter: `project_id=eq.${projectId}`,
        },
        loadAnnotations
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
      if (layerGroupRef.current) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map, projectId]);

  useEffect(() => {
    if (!map || !projectId || geomanInitialized.current) return;

    if (typeof window !== "undefined" && !(window as unknown as { L_PM?: boolean }).L_PM) {
      try {
        require("@geoman-io/leaflet-geoman-free");
      } catch {
        // Geoman might already be loaded
      }
    }

    map.pm?.addControls({
      position: "bottomleft",
      drawMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawRectangle: false,
      drawPolygon: false,
      drawCircleMarker: false,
      drawText: true,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    });

    geomanInitialized.current = true;

    const supabase = createClient();

    const handleCreate = async (e: L.LeafletEvent & { layer: L.Layer; shape?: string }) => {
      const layer = e.layer;
      let type: AnnotationType = "line";
      let geom: GeoJSON.Geometry;
      let properties: Record<string, unknown> = {};

      if (layer instanceof L.Marker) {
        const latlng = layer.getLatLng();
        const opts = (layer as L.Marker & { options?: { textMarker?: boolean; text?: string } }).options;
        const isTextMarker = opts?.textMarker === true;
        geom = {
          type: "Point",
          coordinates: [latlng.lng, latlng.lat],
        };
        if (isTextMarker && opts?.text) {
          type = "text";
          properties = { text: opts.text };
        } else {
          type = "marker";
        }
      } else if (layer instanceof L.Polyline) {
        const geo = (layer as unknown as { toGeoJSON?: () => { geometry?: GeoJSON.Geometry } }).toGeoJSON?.();
        geom = geo?.geometry ?? {
          type: "LineString",
          coordinates: (layer.getLatLngs() as L.LatLng[]).map((ll) => [ll.lng, ll.lat]),
        };
        type = drawModeRef.current === "arrow" ? "arrow" : "line";
      } else {
        map.removeLayer(layer);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("map_annotations")
        .insert({
          project_id: projectId,
          type,
          geom,
          properties,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Eroare la salvare annotație:", error);
        alert(`Nu s-a putut salva: ${error.message}`);
        return;
      }
      map.removeLayer(layer);
      if (inserted) loadAnnotationsRef.current?.();
    };

    const handleRemove = async (e: L.LeafletEvent) => {
      const layer = (e as L.LeafletEvent & { layer: L.Layer }).layer;
      const id = (layer as L.Layer & { _annotationId?: string })._annotationId;
      if (id) {
        await supabase.from("map_annotations").delete().eq("id", id);
      }
    };

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
      map.pm?.removeControls();
      geomanInitialized.current = false;
    };
  }, [map, projectId, onRefresh]);

  const setMode = (mode: AnnotationType | null) => {
    drawModeRef.current = mode;
    setDrawMode(mode);
    if (map?.pm) {
      map.pm.disableDraw();
      if (mode === "line" || mode === "arrow") {
        map.pm.enableDraw("Line");
      } else if (mode === "marker") {
        map.pm.enableDraw("Marker");
      } else {
        map.pm.disableDraw();
      }
    }
  };

  return (
    <div className="absolute top-20 left-4 z-[1100] flex flex-col gap-1 bg-white/95 rounded-lg shadow-lg p-1 border">
      {tools.includes("line") && (
        <button
          type="button"
          onClick={() => setMode(drawMode === "line" ? null : "line")}
          className={`px-2 py-1 text-xs rounded ${drawMode === "line" ? "bg-blue-100" : "hover:bg-slate-100"}`}
          title="Linie"
        >
          Linie
        </button>
      )}
      {tools.includes("arrow") && (
        <button
          type="button"
          onClick={() => setMode(drawMode === "arrow" ? null : "arrow")}
          className={`px-2 py-1 text-xs rounded ${drawMode === "arrow" ? "bg-blue-100" : "hover:bg-slate-100"}`}
          title="Săgeată"
        >
          Săgeată
        </button>
      )}
      {tools.includes("marker") && (
        <button
          type="button"
          onClick={() => setMode(drawMode === "marker" ? null : "marker")}
          className={`px-2 py-1 text-xs rounded ${drawMode === "marker" ? "bg-blue-100" : "hover:bg-slate-100"}`}
          title="Semn atenționare"
        >
          Semn
        </button>
      )}
    </div>
  );
}
